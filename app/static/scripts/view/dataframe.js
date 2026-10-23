import * as View from "./view.js";
import * as Chart from "./charts.js";
import * as Dashboard from "./dashboard.js";
import * as Identifier from "./identifiers.js";
import {dataframeLog, ecu, analysis, analysisReport} from "./init.js";

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

    analysis.reset();
    analysisReport.updateFaultPill();
    Chart.resetChartTime();
    dataframeLog._dataframes = [];

    dataframes.forEach((df, i) => {
        // analyse progressively so the status log mirrors a live session
        dataframeLog._dataframes.push(df);
        analysis.analyse();
        Chart.updateCharts(df, analysis.status.at(-1)?.operationalFaults, false);
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

    return dataframes.length;
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
