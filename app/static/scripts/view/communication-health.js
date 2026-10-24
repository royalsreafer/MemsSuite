import {communicationDiagnostics, STALE_FRAME_THRESHOLD_MS} from "../rosco/mems-communication-diagnostics.js";

let monitor;
let footerResizeObserver;
let footerManuallyToggled = false;

export function downloadSupportLog(context) {
    communicationDiagnostics.recordEvent("support_log_exported");
    const report = {
        formatVersion: 1,
        generatedAt: new Date().toISOString(),
        context: {
            ...context,
            browser: window.navigator.userAgent,
        },
        diagnostics: communicationDiagnostics.getSnapshot(),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = report.generatedAt.replace(/[:.]/g, "-");

    link.href = url;
    link.download = `memssuite-support-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function startCommunicationHealthMonitor(getConnected) {
    if (monitor !== undefined) {
        clearInterval(monitor);
    }

    attachCollapseControl();
    reserveFooterSpace();
    refreshCommunicationHealth(getConnected());
    monitor = setInterval(() => refreshCommunicationHealth(getConnected()), 1000);
}

function attachCollapseControl() {
    const button = document.getElementById("toggleCommunicationHealthButton");
    const footer = document.getElementById("template-footer");
    if (button === null || footer === null || button.dataset.bound === "true") {
        return;
    }

    button.dataset.bound = "true";
    if (window.innerHeight < 900) {
        // Keep the fixed footer from covering the dashboard in shorter windows.
        footer.classList.add("is-collapsed");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "Expand communication footer");
    }
    window.addEventListener("resize", () => {
        if (!footerManuallyToggled && window.innerHeight < 900 && !footer.classList.contains("is-collapsed")) {
            footer.classList.add("is-collapsed");
            button.setAttribute("aria-expanded", "false");
            button.setAttribute("aria-label", "Expand communication footer");
            reserveFooterSpace();
        }
    });
    button.addEventListener("click", () => {
        footerManuallyToggled = true;
        const collapsed = footer.classList.toggle("is-collapsed");
        button.setAttribute("aria-expanded", `${!collapsed}`);
        button.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} communication footer`);
        reserveFooterSpace();
    });
}

function reserveFooterSpace() {
    const footer = document.getElementById("template-footer");
    if (footer === null) {
        return;
    }

    const updateSpace = () => {
        document.body.style.paddingBottom = `${footer.offsetHeight + 16}px`;
    };

    updateSpace();
    if (typeof ResizeObserver !== "undefined") {
        footerResizeObserver?.disconnect();
        footerResizeObserver = new ResizeObserver(updateSpace);
        footerResizeObserver.observe(footer);
    } else {
        window.addEventListener("resize", updateSpace);
    }
}

export function refreshCommunicationHealth(connected) {
    const snapshot = communicationDiagnostics.getSnapshot();
    const connection = document.getElementById("communication-connection");
    const stream = document.getElementById("communication-stream");
    const led = document.getElementById("communication-health-led");
    const streamState = getStreamState(connected, snapshot);

    if (connection !== null) {
        connection.textContent = connected ? "Connected" : "Disconnected";
    }
    if (stream !== null) {
        stream.textContent = getStreamStatus(connected, snapshot);
    }
    if (led !== null) {
        led.className = `communication-health-led is-${streamState}`;
        led.setAttribute("aria-label", `Communication ${getLedLabel(streamState)}`);
    }

    setMetric("communication-frames", snapshot.framesReceived);
    setMetric("communication-rate", snapshot.averageFrameRate === undefined
        ? "—"
        : `${snapshot.averageFrameRate.toFixed(1)} frames/s`);
    setMetric("communication-last-frame", formatFrameAge(snapshot.lastFrameAgeMs));
    setMetric("communication-timeouts", snapshot.timeouts);
    setMetric("communication-incomplete", snapshot.incompleteResponses);
    setMetric("communication-gaps", snapshot.frameGaps);
    setMetric("communication-reconnects", snapshot.reconnects);

    const card = document.getElementById("communication-health");
    if (card !== null) {
        card.dataset.connectionState = connected ? "connected" : "disconnected";
        card.dataset.streamState = streamState;
    }
}

function getStreamStatus(connected, snapshot) {
    if (!connected) {
        return "No active ECU connection";
    }
    if (snapshot.lastFrameAgeMs === undefined) {
        return "Waiting for first ECU frame";
    }
    if (snapshot.lastFrameAgeMs > STALE_FRAME_THRESHOLD_MS) {
        return "No recent ECU frames";
    }
    return "ECU data is arriving";
}

function getLedLabel(streamState) {
    switch (streamState) {
        case "current":
            return "healthy";
        case "waiting":
            return "waiting for data";
        case "stale":
            return "stale";
        default:
            return "disconnected";
    }
}

function getStreamState(connected, snapshot) {
    if (!connected) {
        return "disconnected";
    }

    if (snapshot.lastFrameAgeMs === undefined) {
        return "waiting";
    }
    return snapshot.lastFrameAgeMs > STALE_FRAME_THRESHOLD_MS ? "stale" : "current";
}

function formatFrameAge(ageMs) {
    if (ageMs === undefined) {
        return "Never";
    }
    if (ageMs < 1000) {
        return `${ageMs} ms ago`;
    }
    return `${(ageMs / 1000).toFixed(1)} s ago`;
}

function setMetric(id, value) {
    const element = document.getElementById(id);
    if (element !== null) {
        element.textContent = `${value}`;
    }
}
