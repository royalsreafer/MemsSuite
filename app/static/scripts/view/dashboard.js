const gaugeDefinitions = [
    {
        id: "engine-rpm",
        metric: "_80x01_EngineRPM",
        faultKeys: ["_80x19_CrankshaftPositionSensor"],
        title: "Engine speed",
        units: "RPM",
        tooltip: "Measured by the crankshaft sensor.\nExpected warm idle: 800-1,250 RPM.\nUnusually high or missing RPM can indicate an engine or crankshaft-sensor problem.",
        min: 0,
        max: 6000,
        majorTicks: ["0", "1000", "2000", "3000", "4000", "5000", "6000"],
        expected: "Idle: 800-1,250",
        ranges: [{min: 800, max: 1250}],
        highlights: [{from: 800, to: 1250, color: "rgba(26,174,24,.7)"}, {from: 5000, to: 5500, color: "rgba(248,182,69,.8)"}, {from: 5500, to: 6000, color: "rgba(225,7,23,.8)"}],
        decimals: 0,
    },
    {
        id: "map",
        metric: "_80x07_ManifoldAbsolutePressure",
        title: "Manifold pressure",
        units: "kPa",
        tooltip: "Expected warm idle: 30-45 kPa.\nHigher idle readings can indicate a vacuum-line problem.\nAbove 100 kPa is intended for turbocharged engines; the scale supports up to 200 kPa.",
        min: 0,
        max: 200,
        majorTicks: ["0", "20", "40", "60", "80", "100", "120", "140", "160", "180", "200"],
        expected: "Idle: 30-45",
        ranges: [{min: 30, max: 45}],
        highlights: [{from: 0, to: 10, color: "rgba(225,7,23,.8)"}, {from: 30, to: 45, color: "rgba(26,174,24,.8)"}, {from: 100, to: 160, color: "rgba(150,184,255,.8)"}, {from: 160, to: 180, color: "rgba(248,182,69,.8)"}, {from: 180, to: 200, color: "rgba(225,7,23,.8)"}],
        decimals: 0,
    },
    {
        id: "throttle",
        metric: "_80x09_ThrottlePotSensor",
        faultKeys: ["ThrottlePotCircuitFault"],
        title: "Throttle position",
        units: "%",
        tooltip: "Derived from the throttle-potentiometer voltage.\nExpected closed-throttle voltage: 0.6-0.9 V.",
        min: 0,
        max: 100,
        majorTicks: ["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"],
        expected: "Idle voltage: 0.6-0.9 V",
        ranges: [{min: 0.6, max: 0.9}],
        highlights: [{from: 0, to: 15, color: "rgba(26,174,24,.7)"}, {from: 80, to: 100, color: "rgba(225,7,23,.8)"}],
        decimals: 0,
        displayValue: (value) => value * 20,
    },
    {
        id: "iac",
        metric: "_80x12_IACPosition",
        title: "IAC position",
        units: "steps",
        tooltip: "Controls idle airflow through the IAC stepper motor.\nExpected warm idle: 30-55 steps.\nValues near the upper limit indicate limited correction range.",
        min: 0,
        max: 200,
        majorTicks: ["0", "20", "40", "60", "80", "100", "120", "140", "160", "180", "200"],
        expected: "Warm idle: 30-55",
        ranges: [{min: 30, max: 55}],
        highlights: [{from: 30, to: 55, color: "rgba(26,174,24,.8)"}, {from: 180, to: 200, color: "rgba(225,7,23,.8)"}],
        decimals: 0,
    },
    {
        id: "coil-time",
        metric: "_80x17_CoilTime",
        faultKeys: ["_80x17_CoilTime"],
        title: "Coil time",
        units: "ms",
        tooltip: "The ECU coil dwell time.\nExpected range: 0-6 ms.\nLonger dwell times can indicate a coil or battery-related problem.",
        min: 0,
        max: 10,
        majorTicks: ["0", "2", "4", "6", "8", "10"],
        expected: "Expected: 0-6 ms",
        ranges: [{min: 0, max: 6}],
        highlights: [{from: 0, to: 6, color: "rgba(26,174,24,.8)"}, {from: 6, to: 8, color: "rgba(248,182,69,.8)"}, {from: 8, to: 10, color: "rgba(225,7,23,.8)"}],
        decimals: 2,
    },
    {
        id: "battery",
        metric: "_80x08_BatteryVoltage",
        title: "Battery voltage",
        units: "V",
        tooltip: "Expected charging range while running: 12.5-14.5 V.\nLow or high voltage can indicate a charging-system fault.",
        min: 11,
        max: 16,
        majorTicks: ["11", "12", "13", "14", "15", "16"],
        expected: "Charging: 12.5-14.5",
        ranges: [{min: 12.5, max: 14.5}],
        highlights: [{from: 11, to: 12.5, color: "rgba(225,7,23,.8)"}, {from: 12.5, to: 13, color: "rgba(248,182,69,.8)"}, {from: 13, to: 14.5, color: "rgba(26,174,24,.8)"}, {from: 15, to: 16, color: "rgba(225,7,23,.8)"}],
        decimals: 1,
    },
    {
        id: "coolant",
        metric: "_80x03_CoolantTemp",
        faultKeys: ["CoolantTempSensorFault"],
        title: "Coolant temperature",
        units: "°C",
        tooltip: "Used for fuelling and engine-state decisions.\nExpected operating range: 80-95 °C.\nHigh-temperature range: 95-120 °C.",
        min: 0,
        max: 120,
        majorTicks: ["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100", "110", "120"],
        expected: "Operating: 80-95",
        ranges: [{min: 80, max: 95}],
        highlights: [{from: 80, to: 95, color: "rgba(26,174,24,.8)"}, {from: 95, to: 120, color: "rgba(225,7,23,.8)"}],
        decimals: 0,
    },
    {
        id: "intake-air",
        metric: "_80x05_IntakeAirTemp",
        faultKeys: ["IntakeAirTempSensorFault"],
        title: "Intake-air temperature",
        units: "°C",
        tooltip: "Measured before the inlet manifold.\nTypical range: 10-50 °C.\nHigher readings can affect fuelling and indicate heat soak.",
        min: -20,
        max: 80,
        majorTicks: ["-20", "-10", "0", "10", "20", "30", "40", "50", "60", "70", "80"],
        expected: "Typical: 10-50",
        ranges: [{min: 10, max: 50}],
        highlights: [{from: 10, to: 50, color: "rgba(26,174,24,.8)"}, {from: 50, to: 80, color: "rgba(225,7,23,.8)"}],
        decimals: 0,
    },
    {
        id: "lambda",
        metric: "_7Dx06_LambdaVoltage",
        title: "Lambda voltage",
        units: "mV",
        tooltip: "Indicates oxygen-sensor mixture feedback.\nScale: 0-900 mV.\nColours show low, transition, and high-voltage regions.",
        min: 0,
        max: 900,
        majorTicks: ["0", "100", "200", "300", "400", "500", "600", "700", "800", "900"],
        expected: "Valid: 10-900",
        ranges: [{min: 10, max: 900}],
        highlights: [{from: 0, to: 50, color: "rgba(225,7,23,.8)"}, {from: 50, to: 450, color: "rgba(150,184,255,.8)"}, {from: 450, to: 890, color: "rgba(135,60,248,.8)"}, {from: 850, to: 900, color: "rgba(225,7,23,.8)"}],
        decimals: 0,
    },
    {
        id: "short-term-fuel-trim",
        metric: "_7Dx0C_ShortTermFuelTrim",
        title: "Short-term fuel trim",
        units: "%",
        tooltip: "The ECU's immediate fuelling correction.\nValues close to zero are generally expected.\nLarge sustained corrections can indicate an air, fuel, or sensor problem.",
        min: -40,
        max: 40,
        majorTicks: ["-40", "-30", "-20", "-10", "0", "10", "20", "30", "40"],
        expected: "Expected: -10 to +10",
        ranges: [{min: -10, max: 10}],
        highlights: [{from: -40, to: -20, color: "rgba(225,7,23,.8)"}, {from: -20, to: -10, color: "rgba(248,182,69,.8)"}, {from: -10, to: 10, color: "rgba(26,174,24,.8)"}, {from: 10, to: 20, color: "rgba(248,182,69,.8)"}, {from: 20, to: 40, color: "rgba(225,7,23,.8)"}],
        decimals: 0,
    },
    {
        id: "long-term-fuel-trim",
        metric: "_7Dx0B_LongTermFuelTrim",
        title: "Long-term fuel trim",
        units: "%",
        tooltip: "The ECU's learned fuelling correction.\nValues close to zero are generally expected.\nLarge sustained corrections can indicate a vacuum leak or fuelling problem.",
        min: -40,
        max: 40,
        majorTicks: ["-40", "-30", "-20", "-10", "0", "10", "20", "30", "40"],
        expected: "Expected: -10 to +10",
        ranges: [{min: -10, max: 10}],
        highlights: [{from: -40, to: -20, color: "rgba(225,7,23,.8)"}, {from: -20, to: -10, color: "rgba(248,182,69,.8)"}, {from: -10, to: 10, color: "rgba(26,174,24,.8)"}, {from: 10, to: 20, color: "rgba(248,182,69,.8)"}, {from: 20, to: 40, color: "rgba(225,7,23,.8)"}],
        decimals: 0,
    },
    {
        id: "air-fuel-ratio",
        metric: "_7Dx04_AirFuelRatio",
        title: "Air-fuel ratio",
        units: "",
        tooltip: "Describes the measured air-fuel mixture.\nHighlighted stoichiometric region: 13.5-16.5.",
        min: 10,
        max: 20,
        majorTicks: ["10", "12", "14", "16", "18", "20"],
        expected: "Stoichiometric: 13.5-16.5",
        ranges: [{min: 13.5, max: 16.5}],
        highlights: [{from: 10, to: 11, color: "rgba(225,7,23,.8)"}, {from: 11, to: 12, color: "rgba(248,182,69,.8)"}, {from: 13.5, to: 16.5, color: "rgba(26,174,24,.8)"}, {from: 18, to: 19, color: "rgba(248,182,69,.8)"}, {from: 19, to: 20, color: "rgba(225,7,23,.8)"}],
        decimals: 1,
    },
    {
        id: "ignition-advance",
        metric: "_80x16_IgnitionAdvance",
        title: "Ignition advance",
        units: "°",
        tooltip: "Timing angle used by the ECU.\nTypical highlighted range: 8-12° under the conditions represented by this gauge.",
        min: 0,
        max: 20,
        majorTicks: ["0", "5", "10", "15", "20"],
        expected: "Typical: 8-12°",
        ranges: [{min: 8, max: 12}],
        highlights: [{from: 0, to: 5, color: "rgba(225,7,23,.8)"}, {from: 8, to: 12, color: "rgba(26,174,24,.8)"}, {from: 15, to: 20, color: "rgba(225,7,23,.8)"}],
        decimals: 0,
    },
];

const gaugeStyle = {
    width: 220,
    height: 220,
    ticksAngle: 250,
    startAngle: 55,
    strokeTicks: true,
    minorTicks: 5,
    colorPlate: "#222",
    colorMajorTicks: "#f5f5f5",
    colorMinorTicks: "#ddd",
    colorTitle: "#ddd",
    colorUnits: "#ccc",
    colorNumbers: "#eee",
    valueBox: true,
    colorValueText: "#000",
    colorValueBoxRect: "#ccc",
    colorValueBoxRectEnd: "#ccc",
    colorValueBoxBackground: "#ccc",
    colorValueBoxShadow: false,
    colorValueTextShadow: false,
    colorNeedleShadowUp: false,
    colorNeedleShadowDown: "333",
    colorNeedle: "rgba(240,128,128,1)",
    colorNeedleEnd: "rgba(255,160,122,.9)",
    colorNeedleCircleOuter: "rgba(200,200,200,1)",
    colorNeedleCircleOuterEnd: "rgba(200,200,200,1)",
    borderShadowWidth: 0,
    borders: false,
    borderInnerWidth: 0,
    borderMiddleWidth: 0,
    borderOuterWidth: 5,
    colorBorderOuter: "#fafafa",
    colorBorderOuterEnd: "#cdcdcd",
    needleType: "arrow",
    needleWidth: 2,
    needleCircleSize: 7,
    needleCircleOuter: true,
    needleCircleInner: false,
    animationDuration: 400,
    animationRule: "bounce",
    fontNumbersSize: 16,
    fontTitleSize: 14,
    fontUnitsSize: 18,
    fontValueSize: 26,
    animatedValue: true,
};

let gauges = new Map();

function formatValue(value, decimals) {
    return Number(value).toFixed(decimals);
}

function getGaugeStatus(definition, value, faulty) {
    if (faulty) {
        return {label: "Potential fault", className: "is-fault"};
    }

    const inExpectedRange = definition.ranges.some((range) =>
        value >= range.min && value <= range.max
    );

    return inExpectedRange
        ? {label: "Within expected range", className: "is-expected"}
        : {label: "Outside expected range", className: "is-outside"};
}

function updateGauge(gauge, value, faulty) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return;
    }

    const {definition, instance, statusElement} = gauge;
    const status = getGaugeStatus(definition, value, faulty);
    instance.value = definition.displayValue ? definition.displayValue(value) : value;
    statusElement.textContent = status.label;
    statusElement.className = `gauge-status ${status.className}`;
}

export function initialise() {
    gauges = new Map();

    if (typeof window.RadialGauge !== "function") {
        console.error("RadialGauge library is unavailable; dashboard gauges cannot be initialized");
        return;
    }

    gaugeDefinitions.forEach((definition) => {
        const canvas = document.querySelector(`canvas[data-gauge-id="${definition.id}"]`);
        const card = canvas?.closest(".dashboard-gauge");
        const statusElement = card?.querySelector(".gauge-status");
        if (canvas === null || statusElement == null) {
            return;
        }
        card.dataset.dashboardTooltip = definition.tooltip;
        card.tabIndex = 0;
        card.addEventListener("pointermove", (event) => {
            const tooltipWidth = Math.min(480, window.innerWidth * .9);
            const left = Math.min(event.clientX + 16, window.innerWidth - tooltipWidth - 8);
            const top = Math.min(event.clientY + 16, window.innerHeight - 160);
            card.style.setProperty("--dashboard-tooltip-x", `${Math.max(8, left)}px`);
            card.style.setProperty("--dashboard-tooltip-y", `${Math.max(8, top)}px`);
        });
        card.addEventListener("focus", () => {
            const bounds = card.getBoundingClientRect();
            card.style.setProperty("--dashboard-tooltip-x", `${Math.max(8, bounds.left)}px`);
            card.style.setProperty("--dashboard-tooltip-y", `${Math.max(8, bounds.bottom + 8)}px`);
        });

        const instance = new window.RadialGauge({
            ...gaugeStyle,
            renderTo: canvas.id,
            title: definition.title,
            units: definition.units,
            minValue: definition.min,
            maxValue: definition.max,
            majorTicks: definition.majorTicks || [
                String(definition.min),
                String(definition.max),
            ],
            highlights: definition.highlights,
            valueDec: definition.decimals,
            valueInt: definition.decimals === 0 ? 1 : 0,
        });
        instance.draw();
        gauges.set(definition.metric, {definition, instance, statusElement});
    });
}

export function update(df, faults = {}, status = undefined) {
    Object.entries(df).forEach(([metric, value]) => {
        const gauge = gauges.get(metric);
        if (gauge !== undefined) {
            const faultKeys = gauge.definition.faultKeys || [];
            const faulty = faults[metric] === true || faultKeys.some((key) => faults[key] === true);
            updateGauge(gauge, value, faulty);
        }
    });

    const engineRunningLed = document.getElementById("dashboard-engine-running");
    const crankshaftFaultLed = document.getElementById("dashboard-crankshaft-fault");
    const mapFaultLed = document.getElementById("dashboard-map-fault");
    const lambdaLoopLed = document.getElementById("dashboard-lambda-loop");
    if (engineRunningLed !== null && status !== undefined) {
        engineRunningLed.className = `status-led ${status.isEngineRunning ? "is-on" : "is-off"}`;
    }
    if (crankshaftFaultLed !== null && status !== undefined) {
        crankshaftFaultLed.className = `status-led ${faults._80x19_CrankshaftPositionSensor === true ? "is-fault" : "is-off"}`;
    }
    if (mapFaultLed !== null && status !== undefined) {
        mapFaultLed.className = `status-led ${faults._80x07_ManifoldAbsolutePressure === true ? "is-fault" : "is-off"}`;
    }
    if (lambdaLoopLed !== null && status !== undefined) {
        lambdaLoopLed.className = `status-led ${status.isLoopClosed ? "is-on" : "is-off"}`;
    }
}

export function getGaugeCondition(df, faults = {}) {
    let condition = "normal";

    gaugeDefinitions.forEach((definition) => {
        const value = df[definition.metric];
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return;
        }

        const faultKeys = definition.faultKeys || [];
        const hasFault = faults[definition.metric] === true ||
            faultKeys.some((key) => faults[key] === true);
        if (hasFault) {
            condition = "fault";
            return;
        }

        const inExpectedRange = definition.ranges.some((range) =>
            value >= range.min && value <= range.max
        );
        if (condition !== "fault" && !inExpectedRange) {
            condition = "warning";
        }
    });

    return condition;
}
