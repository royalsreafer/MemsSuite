import * as Command from "./mems-1x/mems-commands.js";
import {MemsSerialInterface} from "./mems-serial-interface.js";
import {MEMS_KLineInitComplete, MEMS_KLineInitEcho, MEMS_KLineInitWakeup} from "./mems-1x/mems-commands.js";
import {communicationDiagnostics} from "./mems-communication-diagnostics.js";

export class MemsBrowserSerialInterface extends MemsSerialInterface {
    constructor() {
        super();

        this._reader = undefined; // serial reader
        this._writer = undefined; // serial writer
    }

    //
    // Check if the browser supports the Web Serial API
    //
    isWebSerialSupported() {
        return ("serial" in window.navigator);
    }

    get serialPort() {
        return this._port;
    }

    //
    // connect to the port selected by the user in the browser
    // once connected, open the port for read/write
    //
    async connect() {
        return super.connect();
    }

    //
    // close the port and disconnect from the port
    // returns the status of the connection
    //
    async disconnect() {
        return super.disconnect();
    }

    //
    // send the command bytes to the ecu and wait for the response
    // the command as a byte array and returns the response as a byte array
    //
    async sendAndReceiveFromSerial(command, expectedResponseSize) {
        return super.sendAndReceiveFromSerial(command, expectedResponseSize);
    }

    async receiveFromSerial(command, expectedResponseSize) {
        return super.receiveFromSerial(command, expectedResponseSize);
    }

    //
    // get the port selected by the user
    //
    async _connectToPort() {
        return this._getPort()
            .then((port) => {
                return port;
            })
            .catch(() => {
                return undefined;
            })
    }

    //
    // prompts the user to select the port in the browser
    //
    async _getPort() {
        if (this.isWebSerialSupported()) {
            return await window.navigator.serial.requestPort();
        }
    }

    //
    // open the port for read / write
    //
    async _open() {
        try {
            await this._port.open({baudRate: 9600, bufferSize: 1});
            return true;
        } catch {
            this._port = undefined;
            return false;
        }
    }

    //
    // close the port
    //
    async close() {
        // cancel any reader locks
        if (this._reader !== undefined) {
            await this._reader.cancel()
                .catch(() => {
                });
            await this._reader.releaseLock();
        }

        // forget the port
        await this._port.forget();
        // close the port
        return await this._port.close();
    }

    //
    // write the command to the serial port
    //
    async _write(data) {
        const buffer = new ArrayBuffer(1);
        const view = new Uint8Array(buffer);
        view[0] = data;

        if (this._port !== undefined) {
            if (await this._port.writable) {
                this._writer = this._port.writable.getWriter();
                return await this._writer.write(view)
                    .then(() => {
                        console.debug(`tx: ${this._arrayAsHexString(view)}`);
                    })
                    .catch((error) => {
                        console.error(`error ${error}`);
                        communicationDiagnostics.recordCommunicationError("serial_write_failed");
                    })
                    .finally(() => {
                        this._writer.releaseLock();
                    });
            }
        }
    }

    //
    // read the bytes from the serial port
    // n specifies the number of bytes to read
    //
    async _read(n, expectedCommand) {
        let rxData = Array(n).fill(0);
        let count = 0;

        if (this._port !== undefined) {
            if (await this._port.readable) {
                this._reader = this._port.readable.getReader();
                try {
                    while (count < n) {
                        const {value, done} = await this._reader.read();
                        if (done) {
                            console.warn(`serial reading cancelled`);
                            break;
                        }
                        if (value) {
                            let chunk = value;

                            // ensure we read all the data if we get multiple bytes
                            for (let i = 0; i < chunk.length; i++) {
                                rxData[count++] = chunk[i];
                            }
                        }
                        if (count === 1 && rxData[0] !== expectedCommand) {
                            console.warn(`_read received ${this._arrayAsHexString(rxData)} but expecting first byte to match command  ${this._arrayAsHexString([expectedCommand])}, discarding byte`);
                            count--;
                        }
                        if (count === 2 && (rxData[0] === Command.MEMS_Dataframe80.command || rxData[0] === Command.MEMS_Dataframe7d.command)) {
                            // read the size of the remaining bytes from the dataframe response
                            let size = rxData[1] + 1;
                            if (size !== n) {
                                console.warn(`_read expecting ${n} bytes, ecu response contains ${size}`);
                                n = size;
                            }
                        }
                    }
                } catch (error) {
                    console.error(`_read error ${error}`);
                    communicationDiagnostics.recordCommunicationError("serial_read_failed");
                } finally {
                    this._reader.releaseLock();
                    console.debug(`_read rx: ${this._arrayAsHexString(rxData)}`);
                }
                if (count < n) {
                    communicationDiagnostics.recordIncompleteResponse(n, count);
                }
            } else {
                console.error(`_read serial not readable`);
                communicationDiagnostics.recordCommunicationError("serial_not_readable");
            }
        }

        return rxData;
    }

    async _waitUntil(timestampMs, pause) {
        const start = performance.now();
        while (performance.now() < timestampMs) {
            await new Promise((resolve) => setTimeout(resolve, 1));
            let delta = performance.now() - start;
            if (delta < 10) {
                while (performance.now() < timestampMs) {}
                break;
            }
        }
        return timestampMs + pause;
    }
    async _assertSignalAndWait(before, pause, brk) {
        await this._port.setSignals({ break: brk });
        return await this._waitUntil(before, pause);
    }

    //
    // MEMS 1.9 baud manipulation to wake up and initialise the serial communications "K-Line"
    //
    async kLineInitialisation() {
        // 5 baud wakeup
        await this._kLineWakeup();

        // read kline initialisation echo of 0x00 0x00 0x00
        await this.receiveFromSerial(Command.MEMS_KLineInitWakeup.responseSize, Command.MEMS_KLineInitWakeup.command);

        // receive echo response 0x55 0x76 0x83
        await this.receiveFromSerial(Command.MEMS_KLineInitEcho.responseSize, Command.MEMS_KLineInitEcho.command);

        // invert 0x83 and send 0x7C
        await this._serial.sendAndReceiveFromSerial(Command.MEMS_KLineInitComplete.command, Command.MEMS_KLineInitComplete.responseSize);

        // expect response 0x7C 0xE9
        // TODO verify response

        return true;
    }

    async _kLineWakeup() {
        let ecuAddress = 0x16;
        let pause = 200;

        let before = await this._assertSignalAndWait(performance.now(), pause, false);
        before = await this._assertSignalAndWait(before, pause, true);

        for (let i = 0; i < 8; i++) {
            let bit = (ecuAddress >> i) & 1;
            before = await this._assertSignalAndWait(before, pause, !bit);
        }

        await this._assertSignalAndWait(before, pause, false);

    }
}
