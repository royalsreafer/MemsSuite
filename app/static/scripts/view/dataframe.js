import * as View from "./view.js";
import * as Chart from "./charts.js";
import * as Dashboard from "./dashboard.js";
import * as Identifier from "./identifiers.js";
import {dataframeLog, ecu, analysis, analysisReport} from "./init.js";

let replayTimer;
let replayIndex = 0;
let replaySpeed = 1;
let replayPlaying = false;
let replayStatuses = [];

export function dataframeReceived(ecuResponse) {
    console.info(`dataframe received ${JSON.stringify(ecuResponse)}`);
    let df = ecu.generateDataframeFromECUResponse(ecuResponse);

    // add the dataframe to the log
    dataframeLog.addDataframe(df);

    // analyse for faults and operation status
    analysis.analyse();
    analysisReport.updateFaultPill();

    // set buttons based on state
    View.setButtonsWhenDataHasBeenLogged();
    View.setButtonsOnEngineRunning();

    // update the values in the UI
    updateDataframeMetrics(df);

    const currentStatus = analysis.status.at(-1);
    let currentFaults = [];

    if (currentStatus !== undefined) {
        try {
            currentFaults = currentStatus.operationalFaults;

            // update dashboard items that are a status rather than a value
            // colour faulty metrics red
            if (analysis.status.length > 0) {
                updateState(df, currentStatus);
                if (currentFaults !== undefined) {
                    colouriseFaults(currentFaults);
                }
            }
        } catch (e) {
            console.warn(`exception updating dataframe op status (${e})`);
        }
    }

    // update the charts
    Chart.updateCharts(df, currentFaults);
    Dashboard.update(df, currentFaults, currentStatus);
}

//
// replay an imported log through the analysis, charts and dashboard as if it had been received from the ecu
//
export function importDataframes(csv) {
    const dataframes = dataframeLog.importCSV(csv);

    stopReplay();
    replayIndex = 0;
    replayStatuses = [];
    analysis.reset();
    analysisReport.updateFaultPill();
    Chart.resetChartTime();
    Chart.resetChartHistory();
    dataframeLog._dataframes = [];

    dataframes.forEach((df, i) => {
        // analyse progressively so the status log mirrors a live session
        dataframeLog._dataframes.push(df);
        analysis.analyse();
        const status = analysis.status.at(-1);
        replayStatuses.push(status === undefined ? undefined : {
            isEngineRunning: status.isEngineRunning,
            isLoopClosed: status.isLoopClosed,
            operationalFaults: {...status.operationalFaults},
            condition: Dashboard.getGaugeCondition(df, status.operationalFaults),
        });
        if (status === undefined) {
            replayStatuses[replayStatuses.length - 1] = {
                operationalFaults: {},
                condition: Dashboard.getGaugeCondition(df),
            };
        }
        Chart.updateCharts(df, status?.operationalFaults, false);
    });
    dataframeLog._dataframes = dataframes;
    Chart.refreshCharts();

    const last = dataframes.at(-1);
    const currentStatus = analysis.status.at(-1);

    analysisReport.updateFaultPill();
    View.setButtonsWhenDataHasBeenLogged();
    updateDataframeMetrics(last);

    if (currentStatus !== undefined) {
        updateState(last, currentStatus);
        colouriseFaults(currentStatus.operationalFaults);
        Dashboard.update(last, currentStatus.operationalFaults, currentStatus);
    } else {
        Dashboard.update(last);
    }

    updateReplayControls();
    if (document.getElementById("nav-analysis-tab")?.classList.contains("active")) {
        analysisReport.updateReport();
    }
    return dataframes.length;
}

export function toggleReplay() {
    if (replayPlaying) {
        stopReplay();
    } else {
        startReplay();
    }
}

export function setReplaySpeed(speed) {
    if (Number.isFinite(speed) && speed > 0) {
        replaySpeed = speed;
    }
}

export function seekReplay(index) {
    const dataframes = dataframeLog.dataframes;
    if (dataframes.length === 0) {
        return;
    }

    stopReplay();
    replayIndex = Math.max(0, Math.min(dataframes.length - 1, Math.floor(index)));
    renderReplayFrame();
}

function startReplay() {
    if (dataframeLog.dataframes.length === 0) {
        return;
    }

    if (replayIndex >= dataframeLog.dataframes.length - 1) {
        replayIndex = 0;
    }

    replayPlaying = true;
    updateReplayControls();
    renderReplayFrame();
    scheduleReplayFrame();
}

function stopReplay() {
    replayPlaying = false;
    if (replayTimer !== undefined) {
        clearTimeout(replayTimer);
        replayTimer = undefined;
    }
    updateReplayControls();
}

function scheduleReplayFrame() {
    if (!replayPlaying) {
        return;
    }

    replayTimer = setTimeout(() => {
        replayIndex++;
        if (replayIndex >= dataframeLog.dataframes.length) {
            replayIndex = dataframeLog.dataframes.length - 1;
            stopReplay();
            return;
        }

        renderReplayFrame();
        scheduleReplayFrame();
    }, 250 / replaySpeed);
}

function renderReplayFrame() {
    const dataframe = dataframeLog.dataframes[replayIndex];
    const status = replayStatuses[replayIndex];
    if (dataframe === undefined) {
        return;
    }

    updateDataframeMetrics(dataframe);
    if (status !== undefined) {
        updateState(dataframe, status);
        colouriseFaults(status.operationalFaults);
        Dashboard.update(dataframe, status.operationalFaults, status);
    } else {
        Dashboard.update(dataframe);
    }
    updateReplayPosition(dataframe, status);
    updateReplayControls();
}

function updateReplayControls() {
    const toggle = document.getElementById("replay-toggle-button");
    const progress = document.getElementById("replay-progress");
    const position = document.getElementById("replay-position");
    const conditionBar = document.getElementById("replay-condition-bar");
    const summary = document.getElementById("replay-condition-summary");
    const frameCount = dataframeLog.dataframes.length;

    if (progress !== null) {
        progress.max = Math.max(0, frameCount - 1);
        progress.value = replayIndex;
    }
    if (toggle !== null) {
        toggle.textContent = replayPlaying ? "Pause" : "Play";
    }
    if (position !== null && frameCount > 0) {
        const status = replayStatuses[replayIndex];
        const condition = status?.condition || "normal";
        position.textContent = `Frame ${replayIndex + 1} of ${frameCount} · ${condition}`;
    }
    if (summary !== null && frameCount > 0) {
        const counts = replayStatuses.reduce((result, status) => {
            const condition = status?.condition || "normal";
            result[condition]++;
            return result;
        }, {normal: 0, warning: 0, fault: 0});
        summary.textContent = `Normal: ${counts.normal} · Warnings: ${counts.warning} · Faults: ${counts.fault}`;
    }
    if (conditionBar !== null) {
        conditionBar.replaceChildren();
        replayStatuses.forEach((status, index) => {
            const marker = document.createElement("button");
            marker.type = "button";
            marker.className = `replay-condition-marker ${status?.condition || "normal"}`;
            marker.title = `Frame ${index + 1}: ${status?.condition || "normal"}`;
            marker.addEventListener("click", () => seekReplay(index));
            conditionBar.appendChild(marker);
        });
    }
}

function updateReplayPosition(dataframe, status) {
    const position = document.getElementById("replay-position");
    if (position === null) {
        return;
    }

    const condition = status?.condition || Dashboard.getGaugeCondition(dataframe);
    position.textContent = `Frame ${replayIndex + 1} of ${dataframeLog.dataframes.length} · ${condition}`;
}

function colouriseFaults(faults) {
    if (faults !== undefined) {
        Object.entries(faults).forEach((fault) => {
            const [key, value] = fault;
            const metric = `${Identifier.ecuDataMetric}_${key}`;
            colouriseMetric(metric, value);
        });
    }
}

function colouriseMetric(id, faulty) {
    let elements = document.querySelectorAll(`.${id}`);
    for (let i = 0; i < elements.length; i++) {
        elements[i].classList.remove("fault");
        elements[i].classList.remove("nofault");
        if (faulty) {
            elements[i].classList.add("fault");
        } else {
            elements[i].classList.add("nofault");
        }
    }
}

//
// update the table in the UI that displays the ECU values
//
function updateDataframeMetrics(df) {
    Object.entries(df).forEach((entry) => {
        const [key, value] = entry;
        const metric = `${Identifier.ecuDataMetric}_${key}`;
        updateMetric(metric, value);
    });
}

function updateMetric(metric, value) {
    let elements = document.querySelectorAll(`.${metric}`);
    for (let i = 0; i < elements.length; i++) {
        if (elements[i] !== undefined) {
            elements[i].innerHTML = `${value}`;
        }
    }
}

function updateState(df, status) {
    let updates = [];

    if (status.isEngineRunning) {
        updates.push({id: 'EngineIdle', on: 'Idle', off: 'Throttle Active', state: status.isEngineIdle});
    } else {
        updates.push({id: 'EngineIdle', on: 'Running', off: 'Off', state: status.isEngineRunning});
    }

    updates.push({id:'CoolantTempSensorFault', on:'Fault', off:'No Faults', state:status.isCoolantSensorFaulty});
    updates.push({id:'IntakeAirTempSensorFault', on:'Fault', off:'No Faults', state:status.isAirIntakeSensorFaulty});
    updates.push({id:'FuelPumpCircuitFault', on:'Fault', off:'No Faults', state:status.isFuelPumpCircuitFaulty});
    updates.push({id:'ThrottlePotCircuitFault', on:'Fault', off:'No Faults', state:status.isThrottlePotCircuitFaulty});
    updates.push({id:'_7Dx0A_ClosedLoop', on:'Closed', off:'Open', state:status.isLoopClosed});
    updates.push({id:'_7Dx09_LambdaStatus', on:'Active', off:'Inactive', state:status.isO2SystemActive});

    updates.forEach((entry) => {
        refreshStatus(entry);
    });
}

function refreshStatus(entry) {
    let elements = document.querySelectorAll(`.${Identifier.ecuDataMetric}_${entry.id}`);
    for (let i = 0; i < elements.length; i++) {
        if (entry.state) {
            elements[i].innerHTML = entry.on;
        } else {
            elements[i].innerHTML = entry.off;
        }
    }
}

export function pauseDataframe() {
    let paused = ecu.isPaused;
    ecu.paused = !paused;

    console.info(`paused ${ecu.isPaused}`);
}

export function stopDataframeLoop() {
    ecu.stopDataframeLoop();
}

export function heartbeatReceived(ecuResponse) {
    console.debug(`heartbeat received ${JSON.stringify(ecuResponse)}`);
}
