import {communicationDiagnostics} from "./mems-communication-diagnostics.js";

const SERIAL_TIMEOUT = 2000;
const READ_TIMEOUT = Symbol("serial read timeout");

export class MemsSerialInterface {
    constructor() {
        this._isConnected = false;
        this._port = undefined;
    }

    //
    // check if the serial port is connected
    //
    get isConnected() {
        return this._isConnected;
    }

    //
    // connect to the port selected by the user in the browser
    // once connected, open the port for read/write
    //
    async connect() {
        communicationDiagnostics.recordConnectionAttempt();
        this._isConnected = false;

        try {
            this._port = await this._connectToPort();
            if (this._port === undefined) {
                communicationDiagnostics.recordConnectionFailure("port_not_selected");
                return false;
            }

            const opened = await this._open();
            this._isConnected = opened === true;
            if (this._isConnected) {
                console.info("connect: opened port");
                communicationDiagnostics.recordConnectionEstablished();
            } else {
                communicationDiagnostics.recordConnectionFailure("port_open_failed");
            }
        } catch (error) {
            this._isConnected = false;
            communicationDiagnostics.recordConnectionFailure("connection_error");
            console.error(`connect: error connecting to port (${error})`);
        }

        return this._isConnected;
    }

    //
    // close the port and disconnect from the port
    // returns the status of the connection
    //
    async disconnect() {
        if (this._isConnected) {
            await this.close()
                .then(() => {
                    console.info(`disconnect: closed port`);
                    this._isConnected = false;
                    communicationDiagnostics.recordDisconnected();
                })
                .catch((error) => {
                    console.warn(`disconnect: error closing port ${error}`);
                    communicationDiagnostics.recordCommunicationError("disconnect_failed");
                });
        }

        return Promise.resolve(this._isConnected);
    }

    //
    // send the command bytes to the ecu and wait for the response
    // the command as a byte array and returns the response as a byte array
    //
    async sendAndReceiveFromSerial(command, expectedResponseSize) {
        if (expectedResponseSize < 1) expectedResponseSize = 1;

        if (this._isConnected) {
            await this._write(command);
            return await this.receiveFromSerial(command, expectedResponseSize);
        }

        return [];
    }

    async receiveFromSerial(command, expectedResponseSize) {
        if (expectedResponseSize < 1) expectedResponseSize = 1;

        if (this._isConnected) {
            let timeoutId;
            try {
                const response = await Promise.race([
                    this._read(expectedResponseSize, command),
                    new Promise(resolve => {
                        timeoutId = setTimeout(() => resolve(READ_TIMEOUT), SERIAL_TIMEOUT);
                    }),
                ]);
                if (response === READ_TIMEOUT) {
                    communicationDiagnostics.recordTimeout();
                    return "serial read timeout";
                }
                return response;
            } catch (err) {
                communicationDiagnostics.recordCommunicationError("serial_read_error");
                console.error(`receiveFromSerial exception ${err}`);
                throw err;
            } finally {
                clearTimeout(timeoutId);
            }
        }

        return [];
    }

    //
    // MEMS 1.9 baud manipulation to wake up and initialise the serial communications "K-Line"
    //
    async kLineInitialisation() {
        // abstract function, to be implemented in concrete class
    }

    //
    // get the port selected by the user
    //
    async _connectToPort() {
        // abstract function, to be implemented in concrete class
    }

    //
    // open the port for read / write
    //
    async _open() {
        // abstract function, to be implemented in concrete class
    }

    //
    // close the port
    //
    async close() {
        // abstract function, to be implemented in concrete class
    }

    //
    // write the command to the serial port
    //
    async _write(data) {
        // abstract function, to be implemented in concrete class
    }

    //
    // read the bytes from the serial port
    // n specifies the number of bytes to read
    //
    async _read(n, expectedCommand) {
        // abstract function, to be implemented in concrete class
    }

    //
    // convert bytes into a hex string
    //
    _arrayAsHexString(data) {
        let hex = "";

        data.forEach(value => {
            hex += value.toString(16).padStart(2, '0');
        });

        return hex;
    }
}
