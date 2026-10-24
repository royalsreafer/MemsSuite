import {MemsSerialInterface} from "./mems-serial-interface.js";
import {communicationDiagnostics} from "./mems-communication-diagnostics.js";

export class MemsLocalSerialInterface extends MemsSerialInterface {
    constructor() {
        super();

        this._baseUri = window.location.href.split("/").slice(0, 3).join("/");
    }

    //
    // connect to the port selected by the user in the browser
    // once connected, open the port for read/write
    //
    async connect(port) {
        this._port = port;
        return super.connect();
    }

    //
    // close the port and disconnect from the port
    // returns the status of the connection
    //
    async disconnect() {
        return super.disconnect();
    }

    async _open() {
        let body = {
            Port: this._port,
            MEMSVersion: "1.6"
        }

        try {
            body.MEMSVersion = ecuVersion;
        } catch {
            // use default version
        }

        return await this._sendRequest('POST', `${this._baseUri}/connect`, body)
            .then(response => {
                this._isConnected = response.Connected;
                return this._isConnected;
            }).catch(err => {
                console.warn(`connect error %s`, err);
                return false;
            });
    }

    async close() {
        return await this._sendRequest('POST', `${this._baseUri}/disconnect`)
            .then(response => {
                this._isConnected = response.Connected;
                return this._isConnected;
            }).catch(err => {
                console.warn(`disconnect error %s`, err);
                return false;
            });
    }

    //
    // send the command bytes to the ecu and wait for the response
    // the command as a byte array and returns the response as a byte array
    //
    async sendAndReceiveFromSerial(command, expectedResponseSize) {
        if (expectedResponseSize < 1) expectedResponseSize = 1;

        if (this._isConnected) {
            let ecuCommandResponse = {
                Command: this._arrayAsHexString([command]),
                Response: "",
                ExpectedSize: expectedResponseSize
            }

            return await this._sendRequest('POST', `${this._baseUri}/command`, ecuCommandResponse)
                .then(response => {
                    const bytes = this._hexToBytes(response.Response);
                    if (bytes.length !== expectedResponseSize) {
                        communicationDiagnostics.recordIncompleteResponse(expectedResponseSize, bytes.length);
                    }
                    return bytes;
                }).catch(err => {
                    console.warn(`send receive error %s`, err);
                    communicationDiagnostics.recordCommunicationError("local_command_request_failed");
                    return [];
                });
        }
    }

    //
    // Override receiveFromSerial, not implemented in local serial comms
    //
    async receiveFromSerial(command, expectedResponseSize){
        return [];
    }

    //
    // Override _connectToPort to return the current port
    //
    async _connectToPort() {
        return this._port;
    }

    async getAvailablePorts() {
        return await this._sendRequest('GET', `${this._baseUri}/ports`)
            .then(response => {
                return response;
            }).catch(err => {
                console.warn(`get serial ports error %s`, err);
                return [];
            });
    }

    async _sendRequest(method, endpoint, body) {
        let init = {
            method: method,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }

        return await fetch(endpoint, init).then(async (response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        }).catch((err) => {
            console.warn(`error in get available ports (${err})`);
            communicationDiagnostics.recordCommunicationError("local_request_failed");
            throw err;
        });
    }

    // Convert a hex string to a byte array
    _hexToBytes(hex) {
        let bytes = [];
        for (let c = 0; c < hex.length; c += 2)
            bytes.push(parseInt(hex.substr(c, 2), 16));
        return bytes;
    }
}
