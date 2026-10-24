const MAX_EVENTS = 500;
const MAX_FRAME_INTERVALS = 20;
export const STALE_FRAME_THRESHOLD_MS = 3000;

class CommunicationDiagnostics {
    constructor() {
        this.reset();
    }

    reset() {
        this.sessionStartedAt = Date.now();
        this.connectionAttempts = 0;
        this.successfulConnections = 0;
        this.connectionFailures = 0;
        this.reconnects = 0;
        this.framesReceived = 0;
        this.firstFrameAt = undefined;
        this.lastFrameAt = undefined;
        this.frameIntervals = [];
        this.frameGaps = 0;
        this.timeouts = 0;
        this.incompleteResponses = 0;
        this.communicationErrors = 0;
        this.events = [];
        this.eventsOmitted = 0;
    }

    recordConnectionAttempt() {
        this.connectionAttempts++;
        this.recordEvent("connection_attempt");
    }

    recordConnectionEstablished() {
        if (this.successfulConnections > 0) {
            this.reconnects++;
        }
        this.successfulConnections++;
        this.recordEvent("connection_established");
    }

    recordConnectionFailure(reason) {
        this.connectionFailures++;
        this.recordEvent("connection_failed", {reason});
    }

    recordDisconnected() {
        this.recordEvent("disconnected");
    }

    recordDataframeReceived(now = Date.now()) {
        this.framesReceived++;
        if (this.firstFrameAt === undefined) {
            this.firstFrameAt = now;
        }

        if (this.lastFrameAt !== undefined) {
            const interval = now - this.lastFrameAt;
            this.frameIntervals.push(interval);
            if (this.frameIntervals.length > MAX_FRAME_INTERVALS) {
                this.frameIntervals.shift();
            }
            if (interval > STALE_FRAME_THRESHOLD_MS) {
                this.frameGaps++;
                this.recordEvent("frame_gap", {durationMs: interval});
            }
        }

        this.lastFrameAt = now;
        this.recordEvent("dataframe_received");
    }

    recordTimeout() {
        this.timeouts++;
        this.communicationErrors++;
        this.recordEvent("read_timeout");
    }

    recordIncompleteResponse(expectedBytes, receivedBytes) {
        this.incompleteResponses++;
        this.communicationErrors++;
        this.recordEvent("incomplete_response", {expectedBytes, receivedBytes});
    }

    recordCommunicationError(category) {
        this.communicationErrors++;
        this.recordEvent("communication_error", {category});
    }

    getSnapshot(now = Date.now()) {
        const averageInterval = this.frameIntervals.length > 0
            ? this.frameIntervals.reduce((total, interval) => total + interval, 0) / this.frameIntervals.length
            : undefined;

        return {
            sessionStartedAt: new Date(this.sessionStartedAt).toISOString(),
            connectionAttempts: this.connectionAttempts,
            successfulConnections: this.successfulConnections,
            connectionFailures: this.connectionFailures,
            reconnects: this.reconnects,
            framesReceived: this.framesReceived,
            firstFrameAt: this.firstFrameAt === undefined ? undefined : new Date(this.firstFrameAt).toISOString(),
            lastFrameAt: this.lastFrameAt === undefined ? undefined : new Date(this.lastFrameAt).toISOString(),
            lastFrameAgeMs: this.lastFrameAt === undefined ? undefined : Math.max(0, now - this.lastFrameAt),
            averageFrameRate: averageInterval === undefined ? undefined : 1000 / averageInterval,
            frameGaps: this.frameGaps,
            timeouts: this.timeouts,
            incompleteResponses: this.incompleteResponses,
            communicationErrors: this.communicationErrors,
            events: [...this.events],
            eventsOmitted: this.eventsOmitted,
        };
    }

    recordEvent(type, details = {}) {
        if (this.events.length === MAX_EVENTS) {
            this.events.shift();
            this.eventsOmitted++;
        }
        this.events.push({
            timestamp: new Date().toISOString(),
            type,
            ...details,
        });
    }
}

export const communicationDiagnostics = new CommunicationDiagnostics();
