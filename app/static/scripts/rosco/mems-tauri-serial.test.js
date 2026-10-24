import {describe, it, expect, beforeEach, jest} from "@jest/globals";
import {MemsTauriSerialInterface} from "./mems-tauri-serial.js";

let invoke;

beforeEach(() => {
    invoke = jest.fn();
    window.__TAURI__ = {core: {invoke}};
});

describe("Tauri serial interface", () => {
    it("lists available serial ports in the local adapter shape", async () => {
        invoke.mockResolvedValue({Ports: ["COM3"]});
        const serial = new MemsTauriSerialInterface();

        await expect(serial.getAvailablePorts()).resolves.toEqual({Ports: ["COM3"]});
        expect(invoke).toHaveBeenCalledWith("get_available_ports");
    });

    it("connects with the selected port and ECU version", async () => {
        invoke.mockResolvedValue({Connected: true});
        const serial = new MemsTauriSerialInterface();

        await expect(serial.connect("COM3")).resolves.toBe(true);
        expect(invoke).toHaveBeenCalledWith("connect", {
            port: "COM3",
            memsVersion: "1.6"
        });
        expect(serial.isConnected).toBe(true);
    });

    it("sends byte arrays and returns the ECU response", async () => {
        invoke.mockResolvedValue([0x7d, 0x10]);
        const serial = new MemsTauriSerialInterface();
        serial._isConnected = true;

        await expect(serial.sendAndReceiveFromSerial(0x7d, 2)).resolves.toEqual([0x7d, 0x10]);
        expect(invoke).toHaveBeenCalledWith("send_command", {
            command: [0x7d],
            expectedSize: 2
        });
    });

    it("disconnects the native serial connection", async () => {
        invoke.mockResolvedValue({Connected: false});
        const serial = new MemsTauriSerialInterface();
        serial._isConnected = true;

        await expect(serial.disconnect()).resolves.toBe(false);
        expect(invoke).toHaveBeenCalledWith("disconnect");
        expect(serial.isConnected).toBe(false);
    });
});
