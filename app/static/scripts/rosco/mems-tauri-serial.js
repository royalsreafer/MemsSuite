import {MemsSerialInterface} from "./mems-serial-interface.js";
import {communicationDiagnostics} from "./mems-communication-diagnostics.js";

export class MemsTauriSerialInterface extends MemsSerialInterface {
    async connect(port) {
        this._port = port;
        return super.connect();
    }

    async _connectToPort() {
        return this._port;
    }

    async _open() {
        const version = typeof ecuVersion === "undefined" ? "1.6" : ecuVersion;
        const status = await window.__TAURI__.core.invoke("connect", {
            port: this._port,
            memsVersion: version
        });
        this._isConnected = status.Connected;
        return this._isConnected;
    }

    async close() {
        const status = await window.__TAURI__.core.invoke("disconnect");
        this._isConnected = status.Connected;
        return this._isConnected;
    }

    async sendAndReceiveFromSerial(command, expectedResponseSize) {
        expectedResponseSize = Math.max(1, expectedResponseSize);
        if (!this._isConnected) {
            return [];
        }

        try {
            const response = await window.__TAURI__.core.invoke("send_command", {
                command: Array.isArray(command) ? command : [command],
                expectedSize: expectedResponseSize
            });
            if (response.length !== expectedResponseSize) {
                communicationDiagnostics.recordIncompleteResponse(expectedResponseSize, response.length);
            }
            return response;
        } catch (error) {
            console.warn(`ECU command failed: ${error}`);
            communicationDiagnostics.recordCommunicationError("tauri_command_failed");
            return [];
        }
    }

    async receiveFromSerial() {
        return [];
    }

    async getAvailablePorts() {
        const ports = await window.__TAURI__.core.invoke("get_available_ports");
        return {Ports: ports.Ports};
    }
}
