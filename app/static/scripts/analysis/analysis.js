import {OperationalStatus} from "./operational-status.js";
import * as Constant from "./analysis-constants.js"
import * as Faults from "./analysis-faults.js";

export class Analysis {
    constructor(dataframeLog) {
        this._dataframeLog = dataframeLog;
        this._opStatus = new OperationalStatus();
        this._statusLog = [];
        this._faultHistory = [];
        this._faultLog = [];
    }

    reset() {
        this._opStatus = new OperationalStatus();
        this._statusLog = [];
        this._faultHistory = [];
        this._faultLog = [];
    }

    get dataframes() {
        return this._dataframeLog.dataframes;
    }

    get status() {
        return this._statusLog;
    }

    get faults() {
        this._analyseFaultLog();

        return this._faultLog;
    }

    get hasData() {
        return this._dataframeLog.hasLoggedData;
    }

    //
    // analysis uses the dataframe log
    // easy references to the current complete dataframe and the first one logged are updated
    //
    analyse() {
        if (this._dataframeLog.hasLoggedData) {
            this._opStatus.update(this.dataframes);
            this._statusLog.push(this._opStatus);

            // the status is a single object updated in place, so record the faults seen for each dataframe
            if (this._opStatus.isInitialised) {
                this._faultHistory.push({...this._opStatus.operationalFaults});
            }
        }
    }

    //
    // analyse active faults in the current log
    //
    _analyseFaultLog() {
        this._faultLog = [];

        if (this._dataframeLog.hasLoggedData) {
            // iterate the operational status log and count the number of times the metric is
            // discovered to be outside expected operating parameters

            this._isFaulty("_80x08_BatteryVoltage", Faults.BatteryFault);
            this._isFaulty("_80x17_CoilTime", Faults.CoilFault);
            this._isFaulty("CoolantTempSensorFault", Faults.CoolantFault);
            this._isFaulty("_80x10_IdleHot", Faults.IdleHotFault);
            this._isFaulty("_80x12_IACPosition", Faults.IACFault);
            this._isFaulty("_7Dx1F_JackCount", Faults.JackFault);
            //this._addFault("_7Dx0F_IdleBasePosition", Faults.IdleFault); needs more investigation
            this._isFaulty("IntakeAirTempSensorFault", Faults.AirTempFault);
            this._isFaulty("_80x07_ManifoldAbsolutePressure", Faults.MapFault);
            this._isFaulty("_80x19_CrankshaftPositionSensor", Faults.CrankshaftFault);
            this._isFaulty("_7Dx06_LambdaVoltage", Faults.O2Fault);
            this._isFaulty("_7Dx09_LambdaStatus", Faults.O2Fault);
            this._isFaulty("ThermostatFaulty", Faults.ThermostatFault);
            this._isFaulty("ThrottlePotCircuitFault", Faults.ThrottleFault);
            this._isFaulty("FuelPumpCircuitFault", Faults.FuelPumpFault);
         }

        this._faultLog = this._dedupArrayByProperty(this._faultLog, "id");
        this._faultLog = this._removeFaultsBelowMinimum();

        // add operational stats after fault reconciliation
        this._addEngineWarmToFaults();
    }

    _isFaulty(metric, faultTemplate) {
        let faultCount = this._countFaults(metric);
        if (faultCount > 0) {
            let fault = new Faults.Fault(faultTemplate.id, faultTemplate.title, faultTemplate.level);
            fault.count = faultCount;
            this._faultLog.push(fault);
        }
    }

    _addEngineWarmToFaults() {
        if (this._statusLog.length > 0) {
            if (this._statusLog.at(Constant.CURRENT_DATAFRAME).isEngineWarm === true) {
                let fault = new Faults.Fault(Faults.AtOperatingTemp.id, Faults.AtOperatingTemp.title, Faults.AtOperatingTemp.level);
                fault.count = 1;
                this._faultLog.push(fault);
            }
        }
    }

    _isAboveMinimum(fault) {
        return fault.count >= Constant.MIN_FAULTS;
    }

    _removeFaultsBelowMinimum() {
        return this._faultLog.filter(this._isAboveMinimum);
    }

    _dedupArrayByProperty(arr, prop) {
        let dedupedArray = Array.from(
            arr.reduce((acc, item) => {
                if (item && item[prop]) {
                    acc.set(item[prop], item);
                }
                return acc;
            }, new Map()).values()
        );

        dedupedArray.sort(this._sortByMessageId);
        return dedupedArray;
    }

    _sortByMessageId(a, b) {
        return a.id - b.id;
    }

    _countFaults(metric) {
        let count = 0;

        this._faultHistory.forEach((item) => {
            if (item[metric]) {
                count++;
            }
        });

        return count;
    }
}
