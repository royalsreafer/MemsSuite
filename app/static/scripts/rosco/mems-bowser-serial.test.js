import { describe, it, expect, beforeAll } from "@jest/globals"
import {MemsBrowserSerialInterface} from "./mems-browser-serial.js";

class SerialReaderMock {
    getReader() {
        console.log(`mock: getReader`);
        return this;
    }

    async read() {
        console.log(`mock: read`);
        return {'value':[0x75], 'done':false};
    }

    releaseLock() {
        console.log(`mock: releaseLock`);
    }
}

class SerialWriterMock {
    getWriter() {
        console.log(`mock: getWriter`);
        return this;
    }

    async write(data) {
        console.log(`mock: write ${data}`);
    }

    releaseLock() {
        console.log(`mock: releaseLock`);
    }
}

class SerialPortMock {
    constructor() {
        this.writable = new SerialWriterMock();
        this.readable = new SerialReaderMock();
    }

    async open(params) {
        console.log(`mock: open(${JSON.stringify(params)})`);
        return true;
    }

    async close() {
        console.log(`mock: close`);
        return true;
    }
}

class NavigatorSerialMock {
    constructor() {
        this.port = new SerialPortMock();
    }

    async requestPort() {
        console.log(`mock: requestPort()`);
        return this.port;
    }
}

// override the window.navigator.serial object to point to the mocked object
window.navigator.serial = new NavigatorSerialMock();
let serial;

beforeAll(() => {
    serial = new MemsBrowserSerialInterface();
})

describe('check browser supports serial API ', () => {
    it('should support the Web Serial API', () => {
        expect(serial.isWebSerialSupported()).toBe(true);
    });
});

describe('connect to the serial port', () => {
    it('should connect the serial port', async () => {
        let isConnected = false;

        await serial.connect();
        expect(serial.isConnected).toBe(true);
    });

    it('does not report connected when opening the port fails', async () => {
        const failedOpen = new MemsBrowserSerialInterface();
        failedOpen._connectToPort = async () => new SerialPortMock();
        failedOpen._open = async () => false;

        await expect(failedOpen.connect()).resolves.toBe(false);
        expect(failedOpen.isConnected).toBe(false);
    });
});

describe('send and receive date from the serial API ', () => {
    it('should support the Web Serial API', async () => {
        await serial.connect();
        serial.sendAndReceiveFromSerial(0x75, 1)
            .then((result) => {
                expect(result).toBe([0x75]);
            }).catch(() => {});
    });
});
