import * as Identifier from "./identifiers.js";
import {analysisReport, dataframeLog, ecu} from "./init.js";
import {communicationDiagnostics} from "../rosco/mems-communication-diagnostics.js";

export function showToast(message) {
    let alertText = window.document.getElementById(Identifier.alertToastTextId);
    alertText.innerHTML = message;

    let toast = new window.bootstrap.Toast(document.querySelector(`#${Identifier.alertToastId}`));
    toast.show();
}

export function showTab(tabId) {
    let tab = new window.bootstrap.Tab(document.getElementById(tabId));
    tab.show();
}

export function updateECUID(ecuId) {
    let ecuIdText = document.getElementById(Identifier.ecuId);
    ecuIdText.innerHTML = `ECU ID: ${ecuId}`;
}

//
// update the analysis report, this is a potentially expensive operation
// so the report is only created when the user navigates to the report
//
export async function displayAnalysis() {
    analysisReport.updateReport();
}

//
// enable buttons when data has been logged and the ecu has been disconnected
//

export function attachTabEventListeners(){
    document.getElementById("nav-analysis-tab").addEventListener('click', displayAnalysis);
}

export function setButtonsWhenDataHasBeenLogged() {
    let control = document.querySelectorAll(`.${Identifier.hasLoggedDataClass}`);
    for (let i = 0; i < control.length; i++) {
        control[i].disabled = !(dataframeLog.hasLoggedData);
    }

    control = document.querySelectorAll(`.${Identifier.hasSessionDataClass}`);
    for (let i = 0; i < control.length; i++) {
        control[i].disabled = communicationDiagnostics.getSnapshot().framesReceived === 0;
    }
}

export function setButtonsOnConnectionState() {
    let control = document.querySelectorAll(`.${Identifier.enabledWhenEcuIsConnected}`);
    for (let i = 0; i < control.length; i++) {
        control[i].disabled = !ecu.isConnected;
    }

    control = document.querySelectorAll(`.${Identifier.enabledWhenEcuIsDisconnected}`);
    for (let i = 0; i < control.length; i++) {
        control[i].disabled = ecu.isConnected;
    }
}

export function setButtonsOnEngineRunning() {
    let control = document.querySelectorAll(`.${Identifier.enabledWhenKeyOnEngineOff}`);
    for (let i = 0; i < control.length; i++) {
        control[i].disabled = ecu.isEngineRunning;
    }
}

export function getButtonText(id) {
    let text = "";
    let btn = document.getElementById(id);

    if (btn !== undefined) {
        text = btn.textContent || btn.innerText;
    }

    return text;
}


