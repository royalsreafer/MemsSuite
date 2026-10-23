import {EventQueue, EventTopic} from "../rosco/mems-queue.js";
import {MemsBrowserSerialInterface} from "../rosco/mems-browser-serial.js";
import {MemsEcu16} from "../rosco/mems-1x/mems-ecu16.js";
import {MemsEcu19} from "../rosco/mems-1x/mems-ecu19.js";
import {DataframeLog} from "../rosco/mems-dataframe-log.js";
import {Analysis} from "../analysis/analysis.js";
import {AnalysisReport} from "./analysis-report.js";

import * as Dataframe from "./dataframe.js";
import * as Actuator from "./actuators.js";
import * as Adjustment from "./adjustments.js";
import * as Controls from "./controls.js";
import * as Chart from "./charts.js";
import * as Dashboard from "./dashboard.js";
import * as View from "./view.js";

export const responseEventQueue = new EventQueue();
export var ecu = undefined;
export var ecuVersion = "1.6";
export const dataframeLog = new DataframeLog();
export const analysis = new Analysis(dataframeLog);
export const analysisReport = new AnalysisReport(analysis);
export var charts = [];
export var initialised = false;
export var memsSerialInterface = undefined;
export var isLocal = false;
export const MEMS16 = "1.6";
export const MEMS19 = "1.9";
export const logControl = enableLogging(true);

export async function initialise(serialInterface) {
    if (!initialised) {
        // prevent initialisation occurring more than once.
        initialised = true;

        setECU(MEMS16, serialInterface);

        initialiseSubscribers();

        // create the charts and then show the ecu data tab
        // rendering of the charts gets deferred which interrupts the js loop
        // causing serial errors.
        Chart.createCharts();
        Chart.createSparks();
        Dashboard.initialise();

        View.showTab('nav-dashboard-tab');

        Controls.attachControlEventListeners();
        Adjustment.attachAdjustmentsEventListeners();
        Actuator.attachActuatorEventListeners();
        View.attachTabEventListeners();
        View.setButtonsOnConnectionState();
        View.setButtonsOnEngineRunning();

        logControl.disable();
    }
}

export function setRunningLocal() {
    isLocal = true;
}

export async function loadTemplates() {
    const templateBaseUrl = '/static/templates';
    const templates = ['footer','dashboard','actuators','adjustments','ecudata','charts','analysis','guidance'];
    let templateUrls = []

    for (let i=0; i < templates.length; i++) {
        const url = `${templateBaseUrl}/${templates[i]}.html`;
        templateUrls.push(url);
    }

    for (let i = 0; i < templates.length; i++) {
        try {
            const response = await fetch(templateUrls[i]);
            const text = await response.text();
            const target = document.getElementById(`template-${templates[i]}`);
            if (target !== null) {
                target.innerHTML = text;
            }
        } catch (err) {
            console.warn(`Failed to fetch template ${templateUrls[i]} (${err})`);
        }
    }
}

export function setECU(ecuVersion, serialInterface) {
    // the serial interface to be used is set by the application being server based or running as a local app
    // we will try to reuse the existing serial interface if one exists
    window.ecuVersion = ecuVersion;

    console.info(`ecuVersion ${ecuVersion}`);

    if  (memsSerialInterface === undefined) {
        // no existing serial interface
        if (serialInterface === undefined) {
            // serial interface not specified, create a browser serial interface
            memsSerialInterface = new MemsBrowserSerialInterface();
        } else {
            // assign the specified serial interface
            memsSerialInterface = serialInterface;
        }
    }

    if (ecuVersion === MEMS19) {
        ecu = new MemsEcu19(responseEventQueue, memsSerialInterface);
    } else {
        ecu = new MemsEcu16(responseEventQueue, memsSerialInterface);
    }
}

function initialiseSubscribers() {
    responseEventQueue.subscribe(EventTopic.Dataframe, Dataframe.dataframeReceived);
    responseEventQueue.subscribe(EventTopic.Heartbeat, Dataframe.heartbeatReceived);
    responseEventQueue.subscribe(EventTopic.Actuator, Actuator.actuatorReceived);
    responseEventQueue.subscribe(EventTopic.Adjustment, Adjustment.adjustmentReceived);
    responseEventQueue.subscribe(EventTopic.Reset, Controls.resetReceived);
}

export function sendCommand(ecuCommand) {
    // send the command to the top of the queue
    // this ensures that it gets serviced next
    ecu.addCommandToSendQueue(ecuCommand, true);
}

function enableLogging(isEnabled) {
    const originalLog = console.info;
    let loggingEnabled = isEnabled;

    console.info = function() {
        if (loggingEnabled) {
            originalLog.apply(console, arguments);
        }
    };

    return {
        enable: function() {
            loggingEnabled = true;
        },
        disable: function() {
            loggingEnabled = false;
        }
    };
}