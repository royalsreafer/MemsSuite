import * as Constant from "./analysis-constants.js"
import {Battery} from "./battery.js"
import {Lambda} from "./lambda.js";
import {Thermostat} from "./thermostat.js";
import {Engine} from "./engine.js";

export class OperationalStatus {
    _dataframes;
    _dataframe;
    _operationalFaults;
    _engine;
    _thermostat;
    _lambda;
    _battery;
    _initialised;

    constructor() {
        this._operationalFaults = {};
        this._initialiseFaults();
    }

    update(dataframes) {
        this._dataframes = dataframes;
        this._dataframe = dataframes.at(Constant.CURRENT_DATAFRAME);

        if (!this._initialised) {
            this._initialiseSensors()
        } else {
            this._engine.update(dataframes);
            this._thermostat.update(dataframes);
            this._battery.update(dataframes);
            this._lambda.update(dataframes);
        }
    }

    get isInitialised() {
        return this._initialised === true;
    }

    get dataframes() {
        return this._dataframes;
    }

    get dataframe() {
        return this._dataframe;
    }

    get operationalFaults() {
        this._operationalFaults._80x03_CoolantTemp = this.isThermostatFaulty;
        this._operationalFaults._80x07_ManifoldAbsolutePressure = this.isMAPHigh;
        this._operationalFaults._80x08_BatteryVoltage = this.isBatteryVoltageLow;
        this._operationalFaults._80x10_IdleHot = this.isHotIdleFaulty;
        this._operationalFaults._80x12_IACPosition = this.isIACFaulty || this.isStepperMotorOutOfExpectedRange;
        this._operationalFaults._80x17_CoilTime = this.isCoilFaulty;
        this._operationalFaults._80x19_CrankshaftPositionSensor = this.isCrankshaftSensorFaulty;
        this._operationalFaults._7Dx06_LambdaVoltage = this.isLambdaOutOfRange || this.isLambdaFaulty;
        this._operationalFaults._7Dx09_LambdaStatus = this.isO2SystemFaulty;
        this._operationalFaults._7Dx0F_IdleBasePosition = this.isEngineIdleFaulty || this.isIdleSpeedFaulty;
        this._operationalFaults._7Dx13_IdleSpeedOffset = this.isIACFaulty;
        this._operationalFaults._7Dx1F_JackCount = this.isJackCountHigh;
        this._operationalFaults.CoolantTempSensorFault = this.isCoolantSensorFaulty;
        this._operationalFaults.IntakeAirTempSensorFault = this.isAirIntakeSensorFaulty;
        this._operationalFaults.FuelPumpCircuitFault = this.isFuelPumpCircuitFaulty;
        this._operationalFaults.ThrottlePotCircuitFault = this.isThrottlePotCircuitFaulty;
        this._operationalFaults.ThermostatFaulty = this.isThermostatFaulty;
        this._operationalFaults.IdleFault = this.isEngineIdleFaulty;

        //console.info(`operational faults found ${JSON.stringify(this._operationalFaults)}`);

        return this._operationalFaults;
    }

    get isEngineRunning() {
        return (this._dataframe._80x01_EngineRPM > Constant.ENGINE_NOT_RUNNING);
    }

    //
    // find the time that the engine started, return undefined if the engine has not been started
    //
    get engineStartedAt() {
        // if the engine is running at the start of the run, then return that as the started time
        if (this._dataframes.at(0).isEngineRunning) {
            return new(this._dataframes.at(0)._80x00_Time);
        } else {
            if (this._dataframes.length > 1) {
                let previous = this._dataframes.at(Constant.PREVIOUS_DATAFRAME);

                // set the engine start time if we're running now but off in the previous dataframe
                if (this.isEngineRunning && !previous.isEngineRunning) {
                    return new Date(this._dataframe._80x00_Time);
                }
            }
        }

        return undefined;
    }

    get isEngineWarm() {
        return (this._dataframe._80x03_CoolantTemp >= Constant.MIN_ENGINE_OPERATING_TEMPERATURE);
    }

    //
    // engine is deemed to be at idle if the engine is running and the angle of the throttle pot indicates the throttle is off
    // later MEMS ECUs use the throttle pot to determine the idle position
    //
    get isEngineIdle() {
        return ((this.isEngineRunning) && (this._dataframe._80x09_ThrottlePotSensor <= Constant.DEFAULT_IDLE_THROTTLE_POT_VOLTAGE));
    }

    get isLoopClosed() {
        return this._dataframe._7Dx0A_ClosedLoop;
    }

    //
    // throttle is active if the throttle is > 14 degrees or engine rpm is > 1300
    // this method is used in the python based analysis, but it not currently used as part of the js implementation
    //
    get isThrottleActive() {
        return ((this._dataframe._80x09_ThrottlePotSensor > Constant.DEFAULT_IDLE_THROTTLE_POT_VOLTAGE) || (this._dataframe._80x01_EngineRPM > Constant.MAX_IDLE_RPM));
    }

    get isBatteryVoltageLow() {
        const lowBattery = this._battery.isLow();
        const batteryNotCharging = !this._battery.isCharging();

        return (lowBattery && batteryNotCharging);
    }

    //
    // battery must not be low as this will affect the coil timing
    //
    get isCoilFaulty() {
        if (this.isEngineIdle) {
            return (!this.isBatteryVoltageLow && (this._dataframe._80x17_CoilTime > Constant.MAX_IDLE_COIL_TIME));
        } else {
            return false
        }
    }

    //
    // MAP value should be less than 45kPa when the engine is at idle
    //
    get isMAPHigh() {
        return this.isEngineIdle && (this._dataframe._80x07_ManifoldAbsolutePressure > Constant.MAX_MAP_VALUE);
    }

    //
    // if the lambda status is 0 and the lambda is not oscillating then ecu is not using the o2 system
    //
    get isO2SystemFaulty() {
        return (!this._lambda.isOscillating || this._lambda.isHeaterFaulty || this._lambda.isOutOfRange);
    }

    //
    // This is the number of steps from 0 which the ECU will use as guide for starting idle speed control during engine warm up.
    // The value will start at quite a high value (>100 steps) on a very cold engine and fall to < 50 steps on a fully warm engine.
    // A high value on a fully warm engine or a low value on a cold engine will cause poor idle speed control.
    // Idle run line position is calculated by the ECU using the engine coolant temperature sensor.
    //
    get isEngineIdleFaulty() {
         if (this.isEngineIdle) {
            if (this.isEngineWarm) {
                // fault if > 50 when engine is warm
                return this._dataframe._7Dx0F_IdleBasePosition > Constant.MAX_IDLE_BASE_POSITION;
            } else {
                // fault if < 50 when engine is cold
                return this._dataframe._7Dx0F_IdleBasePosition < Constant.MIN_IDLE_BASE_POSITION;
            }
        }

        return false
    }

    //
    // fault if idle hot is outside the range of 10 - 50
    //
    get isHotIdleFaulty() {
        if (this.isEngineIdle) {
            if (this.isEngineWarm) {
                return ((this._dataframe._80x10_IdleHot < Constant.MIN_IDLE_HOT) || (this._dataframe._80x10_IdleHot > Constant.MAX_IDLE_HOT));
            }
        }

        return false
    }

    get isStepperMotorOutOfExpectedRange() {
        // stepped motor (IAC) should be between 30-35 when engine is at operating temperature and idle
        if (this.isEngineIdle) {
            if (this.isEngineWarm) {
                return !((this._dataframe._80x12_IACPosition >= Constant.MIN_IAC_STEPS) && (this._dataframe._80x12_IACPosition <= Constant.MAX_IAC_STEPS));
            }
        }

        return false;
    }

    //
    // Also known as stepper motor idle air control valve (IACV) to control engine idle speed and air flow from cold start up
    // A high number of steps indicates that the ECU is attempting to close the stepper or reduce the airflow
    // a low number would indicate the inability to increase airflow
    // IAC position invalid if the idle offset exceeds the max error, yet the IAC Position remains at 0
    //
    get isIACFaulty() {
        return this.isEngineIdle && (this._dataframe._7Dx13_IdleSpeedOffset > Constant.MAX_IDLE_OFFSET) && (this._dataframe._80x12_IACPosition === Constant.INVALID_IAC_POSITION);
    }

    get isLambdaOutOfRange() {
        return this.isEngineRunning && (this._dataframe._7Dx06_LambdaVoltage < Constant.MIN_LAMBDA_VOLTAGE || this._dataframe._7Dx06_LambdaVoltage > Constant.MAX_LAMBDA_VOLTAGE);
    }

    get isJackCountHigh() {
        return this._dataframe._7Dx1F_JackCount >= Constant.MAX_JACK_COUNT;
    }

    get isCrankshaftSensorFaulty() {
        return this.isEngineRunning && this._dataframe._80x19_CrankshaftPositionSensor === Constant.INVALID_CRANKSHAFT_POSITION_SENSOR;
    }

    get isThermostatFaulty() {
        this._thermostat.dataframes = this._dataframes;
        return this._thermostat.isFaulty();

        /*
        if (this.isEngineRunning) {
            const currentTime = new Date(this._dataframe._80x00_Time).getTime();
            const expectedTimeEngineWarm = this._getExpectedEngineWarmTime().getTime();
            return (currentTime > expectedTimeEngineWarm) && (this._dataframe._80x03_CoolantTemp < Constant.MIN_ENGINE_OPERATING_TEMPERATURE);
        } else {
            return false
        }
        */
    }

    get isCoolantSensorFaulty() {
        return this._dataframe.CoolantTempSensorFault;
    }

    get isAirIntakeSensorFaulty() {
        return this._dataframe.IntakeAirTempSensorFault;
    }

    get isFuelPumpCircuitFaulty() {
        return this._dataframe.FuelPumpCircuitFault;
    }

    get isThrottlePotCircuitFaulty() {
        return this._dataframe.ThrottlePotCircuitFault;
    }

    get isO2SystemActive() {
        return (this._dataframe._7Dx09_LambdaStatus === 1);
    }

    //
    // idle speed deviation indicates how far away it is from idle target
    // idle base position indicates the target for IAC position
    // a mean value of more than 100 indicates that the ECU is not in control of the idle speed.
    // This indicates a possible fault condition.
    //
    get isIdleSpeedFaulty() {
        if (this.isEngineRunning) {
            let sum = 0;
            let sample = this._dataframes.slice(-Constant.IDLE_SPEED_SAMPLE_SIZE);

            sample.forEach((item) => {
                sum += item._7Dx0F_IdleBasePosition;
            });
            const mean = sum / sample.length;
            return mean > Constant.MAX_IDLE_SPEED_DEVIATION;
        }

        return false
    }

    get isLambdaFaulty() {
        if (this.isEngineRunning) {
            if (this.engineStartedAt !== undefined) {
                const currentTime = new Date(this._dataframe._80x00_Time).getTime();
                const expectedOscillationsAt = new Date(this.engineStartedAt.getTime() + 90).getTime();
                if (currentTime > expectedOscillationsAt) {
                    return !this._isLambdaOscillating();
                }
            }
        }

        // ignore the lambda and return no fault
        return false
    }

    //
    // check if the lambda voltage is oscillating (std dev > 100)
    // need a full dataset for this analysis
    //
    _isLambdaOscillating() {
        if (this.isEngineRunning) {
            // calculate the mean
            let sum = 0;
            this._dataframes.forEach((item) => {
                sum += item._7Dx06_LambdaVoltage;
            });
            const mean = sum / this._dataframes.length;

            // calculate the standard deviation
            let stddev = 0;
            this._dataframes.forEach((item) => {
                stddev += Math.pow(item._7Dx06_LambdaVoltage - mean, 2);
            });

            stddev = Math.sqrt(stddev / (this._dataframes.length - 1));

            return stddev > Constant.LAMBDA_OSCILLATION_MIN_STDDEV;
        }

        return true;
    }

    //
    // the engine warms at around 11 seconds per degree
    // given the current time and coolant temp, the estimated warm time to 80C can be calculated
    //
    _getExpectedEngineWarmTime() {
        let currentTime = new Date(this._dataframe._80x00_Time);
        let degreesToWarm = Constant.ECU_ENGINE_OPERATING_TEMPERATURE - this._dataframe._80x03_CoolantTemp;
        let secondsToWarm = degreesToWarm * Constant.SECONDS_PER_DEGREE;
        return new Date(currentTime.getTime() + secondsToWarm);
    }

    _initialiseSensors() {
        if (this._dataframes.length > 1) {
            this._engine = new Engine();
            this._thermostat = new Thermostat();
            this._battery = new Battery(this._engine);
            this._lambda = new Lambda(this._engine);
            this._initialised = true;
        }
    }

    _initialiseFaults() {
        this._operationalFaults._80x03_CoolantTemp = false;
        this._operationalFaults._80x07_ManifoldAbsolutePressure = false;
        this._operationalFaults._80x08_BatteryVoltage = false;
        this._operationalFaults._80x10_IdleHot = false;
        this._operationalFaults._80x12_IACPosition = false;
        this._operationalFaults._80x17_CoilTime = false;
        this._operationalFaults._80x19_CrankshaftPositionSensor = false;
        this._operationalFaults._7Dx06_LambdaVoltage = false;
        this._operationalFaults._7Dx09_LambdaStatus = false;
        this._operationalFaults._7Dx0F_IdleBasePosition = false;
        this._operationalFaults._7Dx13_IdleSpeedOffset = false;
        this._operationalFaults._7Dx1F_JackCount = false;
        this._operationalFaults.CoolantTempSensorFault = false;
        this._operationalFaults.IntakeAirTempSensorFault = false;
        this._operationalFaults.FuelPumpCircuitFault = false;
        this._operationalFaults.ThrottlePotCircuitFault = false;
        this._operationalFaults.ThermostatFaulty = false;
    }
}
