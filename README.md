# MemsSuite

MemsSuite (formerly WebMemsFCR) is a diagnostic tool for Rover MEMS engine control units. It connects to MEMS 1.3, 1.6, and 1.9 ECUs through a compatible SPI diagnostic cable and displays live ECU data, actuator controls, adjustments, charts, and diagnostic analysis.

The project is the successor to the original MemsFCR diagnostic application.

## Features

- Connects to supported Rover MEMS ECUs over a serial diagnostic cable.
- Displays ECU sensor and operating values.
- Reports potential sensor, idle, lambda/O2, battery, MAP, IAC, and other faults.
- Provides a native dashboard with current-value gauges, min/max limits, and expected operating ranges.
- Shows live charts with elapsed time, fault highlighting, and historical scrolling.
- Exports ECU data as CSV.
- Displays live communication health in the footer, including a status LED, frame timing, timeouts, incomplete responses, and gaps.
- Exports a privacy-conscious support log with connection events and communication metrics; it does not include raw ECU data, ECU ID, or selected serial-port name.
- Imports a previously exported CSV log for replay and analysis.
- Provides actuator and adjustment controls where supported by the ECU.

Analysis results are indications based on recorded ECU values and thresholds. They are not a replacement for mechanical or electrical diagnosis.

## Differences from the original MemsFCR application

MemsSuite keeps the familiar diagnostic concepts from the original application but provides a browser-based interface and a different workflow:

- **Dashboard gauges:** The Dashboard uses radial gauges for RPM, MAP, throttle position, IAC position, battery voltage, coolant and intake-air temperature, lambda voltage, fuel trims, air-fuel ratio, and ignition advance. Gauge scales, coloured operating bands, status LEDs, and hover guidance make the current reading easier to interpret.
- **CSV replay:** Use **Download Log** to save ECU data and **Import Log** to replay a CSV without connecting to an ECU. Replay runs through the same analysis, fault reporting, dashboard gauges, and charts used for live data.
- **Charts and history:** Charts use elapsed time starting at zero, retain the imported history, show fault overlays and condition explanations, and support scrolling through older time windows.
- **Browser and local operation:** The hosted application uses browser serial communication; the Tauri desktop application uses native Rust serial transport.
- **Client-side diagnostics:** Fault conditions are derived in the browser from the decoded ECU data. The CSV contains measurements; fault IDs and explanations are produced during live processing or replay.

## Using the online application

The hosted application is available at [web.memsfcr.co.uk](https://web.memsfcr.co.uk).

1. Install the appropriate USB serial driver. FTDI VCP drivers are available from the [FTDI website](https://ftdichip.com/Drivers/VCP.htm).
2. Connect the diagnostic cable to the vehicle diagnostic port.
3. Turn the ignition on. The engine does not need to be running to connect.
4. Connect the cable to the computer.
5. Open MemsSuite and click **Connect**.
6. Select the serial/COM port used by the cable.
7. Use the **Dashboard**, **Charts**, **Analysis**, **Actuators**, and **Adjustments** tabs as required.

Use the **Download Log** button to save a CSV recording. Use **Import Log** to replay a CSV recording without connecting to an ECU.
Use **Support Log** to download communication diagnostics for troubleshooting. The export contains connection and timing summaries, recent diagnostic events, the selected ECU version and browser user-agent; it excludes raw ECU data, ECU ID, and selected serial-port name.

## Repository layout

```text
src-tauri/                 Rust serial transport and Tauri desktop application
app/
  static/                 HTML templates, JavaScript, CSS, and images
app/static/scripts/
  analysis/               Client-side analysis and fault rules
  rosco/                  ECU protocol and dataframe handling
  view/                   Dashboard, chart, import, and report UI
Make.bat                  Windows Tauri build and launch script
Makefile                  macOS Tauri build targets
package.json              JavaScript test dependencies
```

The desktop application is built with Rust and Tauri. Its native serial connection and MEMS protocol transport are in `src-tauri/`; the established HTML/JavaScript frontend remains the WebView UI and continues to implement dataframe decoding, diagnostics, charts, and CSV replay.

## Development prerequisites

- Rust stable with the platform prerequisites listed in the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).
- Tauri CLI 2 (`cargo install tauri-cli --version "^2" --locked`).
- Node.js and npm for JavaScript tests.
- A compatible serial cable and ECU for hardware testing.
- macOS packaging requires the macOS build tools and signing tools when creating signed releases.

## Run and build the Tauri application

From the repository root, start the desktop app in development mode:

```bash
cargo tauri dev
```

Build the native application and platform bundles with:

```bash
cargo tauri build
```

On Windows, `Make.bat` runs the Tauri production build and opens the resulting executable. macOS developers can use the convenience targets in `Makefile`:

```bash
make build
```

## JavaScript tests

Install the Node dependencies and run Jest:

```bash
npm install
npm test
```

The tests cover dataframe parsing, serial adapters, and the client-side analysis modules.

## GitHub Actions

GitHub Actions runs automatically for:

- Pull requests targeting `main`.
- Pushes to `main`.
- Release tags matching `v*.*.*`, such as `v1.0.0`.

Pull requests and `main` pushes run Rust formatting, tests, builds, JavaScript syntax checks, and Jest. A version tag builds a Tauri Windows package and publishes it to a GitHub Release. The release workflow uses GitHub-hosted runners and does not require external deployment credentials.

## Importing and testing a log

An exported CSV can be imported from the application using **Import Log**. The import replays the data through the analysis and charts without requiring an ECU connection.

The repository also contains [logging-simulated-faults.csv](logging-simulated-faults.csv), a generated test log containing persistent simulated fault conditions. It is useful for checking chart fault highlighting, elapsed-time navigation, and analysis reporting.

## Safety and diagnostic notes

- Only use actuator and adjustment controls when you understand their effect.
- Follow the guidance shown in the application before changing ECU settings.
- Switch the ignition off when instructed so ECU adjustments are saved.
- Always verify reported faults with appropriate electrical and mechanical tests.

## License

See [LICENSE](LICENSE).
