import "../thirdparty/chart.umd.js";
import * as Identifier from "./identifiers.js";
import {charts} from "./init.js";

const sparkLength = 120;
const chartLength = 120;
const skipped = (ctx, value) => ctx.p0.skip || ctx.p0.parsed.y === 0 ? value : undefined;
const faulty = (ctx, value) => ctx.p0.parsed.y > 0 ? value : undefined;

var faultsArray = {}
let firstChartTime;
let chartViewOffset = 0;
let chartHistorySlider;
let chartHistoryPosition;

function formatChartValue(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return value;
    }

    return value.toLocaleString(undefined, {
        maximumFractionDigits: 2,
    });
}

function formatElapsedTime(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return value;
    }

    const seconds = Math.max(0, Math.round(value * 10) / 10);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (minutes === 0) {
        return `${seconds}s`;
    }

    return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function getElapsedTime(value) {
    const timestamp = new Date(String(value).replace(" ", "T")).getTime();
    if (Number.isNaN(timestamp)) {
        return 0;
    }

    if (firstChartTime === undefined) {
        firstChartTime = timestamp;
    }

    return Math.max(0, (timestamp - firstChartTime) / 1000);
}

export function resetChartTime() {
    firstChartTime = undefined;
    chartViewOffset = 0;
}

export function resetChartHistory() {
    charts.forEach((chart) => {
        if (chart._history !== undefined) {
            chart._history.labels = [];
            chart._history.data = [];
            chart._history.faults = [];
        }

        chart.data.labels = [];
        chart.data.datasets.forEach((dataset) => {
            dataset.data = [];
        });
        chart.update("none");
    });
}

function scrollCharts(event) {
    const maxOffset = getMaxChartOffset();

    if (maxOffset === 0) {
        return;
    }

    event.preventDefault();
    chartViewOffset = Math.max(
        0,
        Math.min(maxOffset, chartViewOffset + Math.sign(event.deltaY) * 10)
    );
    refreshCharts();
}

function getMaxChartOffset() {
    return charts.reduce((maximum, chart) => {
        const historyLength = chart._history?.labels.length || 0;
        return Math.max(maximum, historyLength - chartLength);
    }, 0);
}

function updateChartNavigation(maxOffset) {
    if (chartHistorySlider !== null && chartHistorySlider !== undefined) {
        chartHistorySlider.max = maxOffset;
        chartHistorySlider.value = chartViewOffset;
        chartHistorySlider.disabled = maxOffset === 0;
    }

    if (chartHistoryPosition !== null && chartHistoryPosition !== undefined) {
        chartHistoryPosition.textContent = chartViewOffset === 0
            ? "Newest data"
            : `Older data (${chartViewOffset} samples back)`;
    }
}

function renderChartWindow(chart) {
    if (chart._history === undefined) {
        return;
    }

    const end = Math.max(0, chart._history.labels.length - chartViewOffset);
    const start = Math.max(0, end - chartLength);

    chart.data.labels = chart._history.labels.slice(start, end);
    chart.data.datasets[0].data = chart._history.data.slice(start, end);
    chart.data.datasets[1].data = chart._history.faults.slice(start, end);
}

const faultConditions = {
    "_80x07_ManifoldAbsolutePressure": "At idle, MAP is above 42 kPa.",
    "_80x08_BatteryVoltage": "Battery voltage is low and the battery is not charging.",
    "_80x10_IdleHot": "Warm idle value is outside the expected 10-55 range.",
    "_80x12_IACPosition": "Warm idle IAC position is outside 30-55 steps, or the IAC cannot correct a large idle offset.",
    "_80x19_CrankshaftPositionSensor": "The engine is running but the crankshaft sensor value is invalid.",
    "_7Dx06_LambdaVoltage": "Lambda voltage is outside 10-900 mV or is not oscillating as expected.",
    "_7Dx09_LambdaStatus": "The O2 system is inactive, out of range, or not oscillating as expected.",
    "_7Dx0F_IdleBasePosition": "Idle-base condition: cold below 45, warm above 50, or a 30-sample mean above 100 steps.",
    "_7Dx1F_JackCount": "Jack count is at least 100 steps.",
    "CoolantTempSensorFault": "The ECU reports a coolant-temperature sensor fault.",
    "IntakeAirTempSensorFault": "The ECU reports an intake-air temperature sensor fault.",
    "FuelPumpCircuitFault": "The ECU reports a fuel-pump circuit fault.",
    "ThrottlePotCircuitFault": "The ECU reports a throttle-potentiometer circuit fault.",
};

function getFaultCondition(metricId) {
    return faultConditions[metricId] || "The value was outside the expected operating conditions.";
}

export function createCharts() {
    chartHistorySlider = document.getElementById("chart-history-slider");
    chartHistoryPosition = document.getElementById("chart-history-position");
    chartHistorySlider?.addEventListener("input", (event) => {
        chartViewOffset = Number(event.target.value);
        refreshCharts();
    });

    let chart = document.querySelectorAll(`.${Identifier.ecuDataChart}`);
    for (let i = 0; i < chart.length; i++) {
        const chartCtx = chart[i];
        const chartId = `${chart[i].className}`; //`${chart[i].id}_graph_${Math.floor(Math.random() * 100)}`;
        const chartTitle = `${chartCtx.title}`;
        const metricId = chartCtx.classList[1];

        const graph = createChart(chartCtx, chartId, chartTitle, metricId);
        chartCtx.addEventListener("wheel", scrollCharts, {passive: false});
        charts.push(graph);
    }
}

export function createSparks() {
    let chart = document.querySelectorAll(`.${Identifier.ecuDataSpark}`);
    for (let i = 0; i < chart.length; i++) {
        const chartCtx = chart[i];
        const chartId = `${chart[i].className}`;

        const graph = createSpark(chartCtx, chartId);
        charts.push(graph);
    }
}

export function updateCharts(df, chartFaults, render = true) {
    if (render) {
        console.debug(`start chart at ${new Date().getTime()}`);
    }
    let time = df[Identifier.ecuDataTimeMetric80];
    if (time === undefined) {
        time = df[Identifier.ecuDataTimeMetric7d];
    }
    const elapsedTime = getElapsedTime(time);

    Object.entries(df).forEach((entry) => {
        const [id, value] = entry;
        const fault = _hasFault(id, chartFaults);
        _updateCharts(id,elapsedTime,value,fault,render);
    });
    updateChartNavigation(getMaxChartOffset());
    if (render) {
        console.debug(`finish chart at ${new Date().getTime()}`);
    }
}

function _hasFault(id, faults) {
    if (faults !== undefined) {
        return faults[id];
    }

    return false;
}

function _updateCharts(id, time, value, fault, render) {
    const chartId = `${Identifier.ecuDataChart} ${id}`;
    const chart = findChart(chartId);
    if (chart !== undefined) {
        // update the main graph
        _addDataToChart(chart, time, value, fault, render);
    }

    const sparkId = `${Identifier.ecuDataSpark} ${id}`;
    const spark = findChart(sparkId);
    if (spark !== undefined) {
        // update the spark
        _addDataToChart(spark, time, value, fault, render);
    }
}

function _addDataToChart(chart, time, value, fault, render) {
    if (chart !== undefined) {
        addData(chart, time, value, fault, render);
    }
}

export function refreshCharts() {
    const maxOffset = getMaxChartOffset();
    chartViewOffset = Math.min(chartViewOffset, maxOffset);
    updateChartNavigation(maxOffset);

    charts.forEach((chart) => {
        renderChartWindow(chart);
        chart.update('none');
    });
}

function createChart(ctx, id, title, metricId) {
    const chart = new Chart(ctx, {
        id: id,
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                cubicInterpolationMode: 'monotone',
                tension: 0,
                borderColor: 'rgba(102,102,255,1)',
                backgroundColor: 'rgba(102,153,204,0.1)',
                fillColor: "rgba(102,153,51,0.1)",
                strokeColor: "rgba(220,220,220,1)",
                borderWidth: 1,
                fill: true,
            },
                {
                    data: [],
                    cubicInterpolationMode: 'monotone',
                    tension: 0,
                    borderWidth: 2,
                    segment: {
                        borderColor: ctx => skipped(ctx, 'rgba(102,102,255,0)') || faulty(ctx, 'rgba(178, 16, 28, 1.0)'),
                        backgroundColor: ctx => skipped(ctx, 'rgba(102,102,255,0)') || faulty(ctx, 'rgba(255,0,0,0.3)'),
                    },
                    fill: true,
                }],
        },
        elements: {
            point: {
                radius: 0,
                hitRadius: 12,
                hoverRadius: 4,
            }
        },
        options: {
            normalized: true,
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false,
            },
            spanGaps: true,
            radius: 0,
            animation: {
                duration: 0
            },
            plugins: {
                tooltip: {
                    filter: (item) => item.datasetIndex === 0,
                    callbacks: {
                        title: (items) => formatElapsedTime(Number(items[0].label)),
                        label: (item) => `${title}: ${formatChartValue(item.parsed.y)}`,
                        footer: (items) => {
                            const item = items[0];
                            const faultValue = item.chart.data.datasets[1]?.data[item.dataIndex];
                            if (typeof faultValue !== "number" || !Number.isFinite(faultValue) || faultValue <= 0) {
                                return "Status: within expected conditions";
                            }

                            return [
                                "Status: potential fault",
                                getFaultCondition(metricId),
                            ];
                        },
                    },
                },
                legend: {
                    display: false,
                },
                //annotation: {
                //    annotations: faultsArray[id],
                //},
                decimation: {
                    enabled: true,
                    algorithm: 'min-max',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: false,
                    grid: {
                        fontStyle: "normal",
                        fontFamily: "'Barlow', sans-serif !important'",
                        color: "rgba(102,153,0,0.2)"
                    },
                    title: {
                        fontSize: 14,
                        fontStyle: "normal",
                        fontFamily: "'Barlow', sans-serif !important'",
                        display: true,
                        text: title,
                    },
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 6,
                        maxRotation: 0,
                        minRotation: 0,
                        callback: function(value) {
                            return formatElapsedTime(Number(this.getLabelForValue(value)));
                        },
                    },
                    title: {
                        display: true,
                        text: "Time",
                    },
                }
            },
        }
    });

    chart._history = {
        labels: [],
        data: [],
        faults: [],
    };
    return chart;
}

function createSpark(ctx, id) {
    const chart = new Chart(ctx, {
        id: id,
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: 'rgba(102,102,255,0.9)',
                //backgroundColor: 'rgba(102,153,204,0.1)',
                fillColor: "rgba(102,153,51,0.2)",
                strokeColor: "rgba(220,220,220,1)",
                borderWidth: 1,
                cubicInterpolationMode: 'monotone',
                tension: 0,
                fill: true,
            },{
                data: [],
                cubicInterpolationMode: 'monotone',
                tension: 0,
                borderWidth: 1,
                segment: {
                    borderColor: ctx => skipped(ctx, 'rgba(102,102,255,0)') || faulty(ctx, 'rgba(202,12,55,1.0)'),
                    backgroundColor: ctx => skipped(ctx, 'rgba(102,102,255,0)') || faulty(ctx, 'rgba(255,0,0,0.3)'),
                },
                fill: true,
            }],
        },
        elements: {
            point: {
                radius: 0 // default to disabled in all datasets
            }
        },
        options: {
            normalized: true,
            responsive: true,
            resizeDelay: 200,
            maintainAspectRatio: false,
            spanGaps: true,
            radius: 0,
            animation: {
                duration: 0
            },
            plugins: {
                legend: {
                    display: false,
                },
            },
            tooltips: {
                enabled: false
            },
            scales: {
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        display:false
                    },
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        display:false
                    },
                }
            }
        },
    });

    chart._history = {
        labels: [],
        data: [],
        faults: [],
    };
    return chart;
}

export async function getChartAsImage(id) {
    const chartId = `${Identifier.ecuDataChart} ${id}`;
    const chart = findChart(chartId);
    if (chart !== undefined) {
        const imageData = await chart.toBase64Image('image/png', 1);
        if (imageData.length > 6) {
            return imageData;
        }
    }
}

export function addData(chart, label, data, fault, render = true) {
    if (chart._history === undefined) {
        chart._history = {
            labels: [],
            data: [],
            faults: [],
        };
    }

    chart._history.labels.push(label);
    chart._history.data.push(data);
    chart._history.faults.push(fault === true ? data : NaN);

    if (render) {
        renderChartWindow(chart);
        chart.update('none');
    }
}

export function findChart(id) {
    for (let i=0; i < charts.length; i++) {
        if (charts[i].canvas.className === id) {
            return charts[i];
        }
    }

    return undefined;
}

function addAnnotation(chart, x,y) {
    var ch = chart.getContext()
    var id = ch.chart.ctx.canvas.id
    var xLabel = -50
    var yLabel = 9

    if (typeof faultsArray[id] === 'undefined') {
        return
    }

    if (y < 8) {
        yLabel = -15
    }

    faultsArray[id].push ({
        type: 'label',
        xValue: x,
        yValue: y,
        xAdjust: xLabel,
        yAdjust: yLabel,
        backgroundColor: 'rgba(173, 23, 33, 1)',
        content: ['fault'],
        textAlign: 'start',
        color: 'rgba(255,255,255,1)',
        borderRadius: 3,
        backgroundShadowColor: 'rgba(197, 197, 197, 1)',
        shadowOffsetX:4,
        shadowOffsetY:4,
        shadowBlur: 2,
        height: 12,
        font: {
            size: 11,
        },
        callout: {
            enabled: true,
            side: 5,
        }
    });
}

function shiftAnnotations(chart) {
    var ch = chart.getContext()
    var id = ch.chart.ctx.canvas.id

    if (typeof faultsArray[id] === 'undefined') {
        return
    }

    if (faultsArray[id].length > 0) {
        // move all x values by 1
        faultsArray[id].forEach((fault) => {
            fault.xValue = fault.xValue - 1
        });

        if (faultsArray[0] < 0) {
            // remove first element
            faultsArray[id].shift()
        }
    }
}

function isNewFault(chart) {
    var ch = chart.getContext()
    var id = ch.chart.ctx.canvas.id

    if (typeof faultsArray[id] === 'undefined') {
        return false
    }

    var len = faultsArray[id].length

    if (len > 0) {
        // if the last fault was triggered on the last data value then not a new fault in this continuous series
        // return false
        var lastFaultAnnotation = faultsArray[id][len - 1].xValue
        var lastFaultPosition = chart.data.datasets[0].data[chartLength - 1]

        return (lastFaultAnnotation !== chartLength - 2) && (lastFaultPosition === 0)
    } else {
        return true
    }
}
