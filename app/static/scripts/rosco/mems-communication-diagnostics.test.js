import {beforeEach, describe, expect, it} from "@jest/globals";
import {communicationDiagnostics} from "./mems-communication-diagnostics.js";

describe("communication diagnostics", () => {
    beforeEach(() => {
        communicationDiagnostics.reset();
    });

    it("tracks connection, frame timing, and communication errors", () => {
        communicationDiagnostics.recordConnectionAttempt();
        communicationDiagnostics.recordConnectionEstablished();
        communicationDiagnostics.recordDataframeReceived(1000);
        communicationDiagnostics.recordDataframeReceived(1500);
        communicationDiagnostics.recordTimeout();
        communicationDiagnostics.recordIncompleteResponse(33, 12);

        const snapshot = communicationDiagnostics.getSnapshot(2000);

        expect(snapshot.connectionAttempts).toBe(1);
        expect(snapshot.successfulConnections).toBe(1);
        expect(snapshot.framesReceived).toBe(2);
        expect(snapshot.lastFrameAgeMs).toBe(500);
        expect(snapshot.averageFrameRate).toBe(2);
        expect(snapshot.timeouts).toBe(1);
        expect(snapshot.incompleteResponses).toBe(1);
        expect(snapshot.communicationErrors).toBe(2);
    });

    it("counts reconnects and long gaps between frames", () => {
        communicationDiagnostics.recordConnectionEstablished();
        communicationDiagnostics.recordDisconnected();
        communicationDiagnostics.recordConnectionEstablished();
        communicationDiagnostics.recordDataframeReceived(1000);
        communicationDiagnostics.recordDataframeReceived(5000);

        const snapshot = communicationDiagnostics.getSnapshot(5000);

        expect(snapshot.reconnects).toBe(1);
        expect(snapshot.frameGaps).toBe(1);
        expect(snapshot.events.map((event) => event.type)).toContain("frame_gap");
    });

    it("bounds recent event history while preserving the omitted count", () => {
        for (let i = 0; i < 510; i++) {
            communicationDiagnostics.recordDisconnected();
        }

        const snapshot = communicationDiagnostics.getSnapshot();

        expect(snapshot.events).toHaveLength(500);
        expect(snapshot.eventsOmitted).toBe(10);
    });
});
