# WebMemsFCR

WebMemsFCR is a browser-based diagnostic tool for Rover MEMS engine control units. It connects to MEMS 1.3, 1.6, and 1.9 ECUs through a compatible SPI diagnostic cable and displays live ECU data, actuator controls, adjustments, charts, and diagnostic analysis.

The project is the successor to the original MemsFCR diagnostic application.

## Features

- Connects to supported Rover MEMS ECUs over a serial diagnostic cable.
- Displays ECU sensor and operating values.
- Reports potential sensor, idle, lambda/O2, battery, MAP, IAC, and other faults.
- Provides a native dashboard with current-value gauges, min/max limits, and expected operating ranges.
- Shows live charts with elapsed time, fault highlighting, and historical scrolling.
- Exports ECU data as CSV.
- Imports a previously exported CSV log for replay and analysis.
- Provides actuator and adjustment controls where supported by the ECU.

Analysis results are indications based on recorded ECU values and thresholds. They are not a replacement for mechanical or electrical diagnosis.

## Using the online application

The hosted application is available at [web.memsfcr.co.uk](https://web.memsfcr.co.uk).

1. Install the appropriate USB serial driver. FTDI VCP drivers are available from the [FTDI website](https://ftdichip.com/Drivers/VCP.htm).
2. Connect the diagnostic cable to the vehicle diagnostic port.
3. Turn the ignition on. The engine does not need to be running to connect.
4. Connect the cable to the computer.
5. Open WebMemsFCR and click **Connect**.
6. Select the serial/COM port used by the cable.
7. Use the **Dashboard**, **Charts**, **Analysis**, **Actuators**, and **Adjustments** tabs as required.

Use the **Download Log** button to save a CSV recording. Use **Import Log** to replay a CSV recording without connecting to an ECU.

## Repository layout

```text
app/
  fcr/                    Go serial and web-server implementation
  static/                 HTML templates, JavaScript, CSS, and images
  webmemsfcr.go           Go application entry point
  go.mod                  Go dependencies
app/static/scripts/
  analysis/               Client-side analysis and fault rules
  rosco/                  ECU protocol and dataframe handling
  view/                   Dashboard, chart, import, and report UI
Make.bat                  Windows build and run script
Makefile                  macOS packaging and build targets
package.json              JavaScript test dependencies
```

The primary application is Go. The repository no longer includes the older Flask/Python implementation.

## Development prerequisites

- Go 1.19 or newer.
- Node.js and npm for JavaScript tests.
- A compatible serial cable and ECU for hardware testing.
- Windows users need a Go installation available on `PATH`.
- macOS packaging requires the macOS build tools and signing tools when creating signed releases.

## Build on Windows

From the repository root, run:

```bat
Make.bat
```

This builds `app` and creates:

```text
dist\windows\webmemsfcr.exe
```

The script also copies the static web resources beside the executable and starts the application. The executable expects its `resources` directory to be beside it, so do not move the `.exe` without that directory.

To build without starting the application:

```powershell
New-Item -ItemType Directory -Force dist\windows | Out-Null
Set-Location app
go build -o ..\dist\windows\webmemsfcr.exe
```

For a manually built Windows executable, copy the runtime resources:

```powershell
New-Item -ItemType Directory -Force ..\dist\windows\resources\static | Out-Null
Copy-Item index.html, error.html ..\dist\windows\resources
Copy-Item -Recurse -Force static\* ..\dist\windows\resources\static
```

## Build on macOS

The Makefile contains macOS application and packaging targets:

```bash
make build
```

Architecture-specific builds are also available:

```bash
make build-arm    # Apple Silicon
make build-amd    # Intel
make build-package
```

The `all` target additionally signs and notarizes the application and requires the appropriate Apple Developer credentials and local signing configuration.

## Run the Go application

The packaged executable opens the browser automatically and selects an available local port.

For a headless server:

```text
webmemsfcr.exe -headless
```

The server listens on a local loopback address. The selected port is written to the application log.

## JavaScript tests

Install the Node dependencies and run Jest:

```bash
npm install
npm test
```

The tests cover dataframe parsing and the client-side analysis modules. The `appdmg` dependency is macOS-only; Windows development environments may need to install the JavaScript test dependencies using a platform-aware npm setup or run the full dependency install on macOS/CI.

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
