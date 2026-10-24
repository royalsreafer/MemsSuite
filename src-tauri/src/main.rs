use serialport::{ClearBuffer, DataBits, FlowControl, Parity, SerialPort, StopBits};
use std::{
    io::{Read, Write},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};
use tauri::State;

const SERIAL_BAUD: u32 = 9600;
const SERIAL_TIMEOUT: Duration = Duration::from_millis(75);
const MAX_RESPONSE_SIZE: usize = 4096;

struct EcuConnection {
    port: Box<dyn SerialPort>,
}

#[derive(Default)]
struct AppState {
    connection: Mutex<Option<EcuConnection>>,
}

#[derive(serde::Serialize)]
struct AvailablePorts {
    #[serde(rename = "Ports")]
    ports: Vec<String>,
}

#[derive(serde::Serialize)]
struct EcuStatus {
    #[serde(rename = "Connected")]
    connected: bool,
}

#[tauri::command]
fn get_available_ports() -> Result<AvailablePorts, String> {
    let ports = serialport::available_ports()
        .map_err(|error| format!("Unable to enumerate serial ports: {error}"))?
        .into_iter()
        .map(|port| normalize_port(port.port_name))
        .fold(Vec::new(), |mut ports, port| {
            if !ports.contains(&port) {
                ports.push(port);
            }
            ports
        });
    Ok(AvailablePorts { ports })
}

#[tauri::command]
fn connect(
    state: State<'_, AppState>,
    port: String,
    mems_version: String,
) -> Result<EcuStatus, String> {
    if !matches!(mems_version.as_str(), "1.6" | "1.9") {
        return Err(format!("Unsupported MEMS version: {mems_version}"));
    }

    let mut connection = state
        .connection
        .lock()
        .map_err(|_| "ECU connection state is unavailable".to_string())?;
    *connection = None;

    let port_name = normalize_port(port);
    let mut serial = serialport::new(port_name, SERIAL_BAUD)
        .data_bits(DataBits::Eight)
        .parity(Parity::None)
        .stop_bits(StopBits::One)
        .flow_control(FlowControl::None)
        .timeout(SERIAL_TIMEOUT)
        .open()
        .map_err(|error| format!("Unable to open serial port: {error}"))?;

    let _ = serial.clear(ClearBuffer::Input);
    if mems_version == "1.9" {
        wake_mems_19(serial.as_mut())?;
    }

    *connection = Some(EcuConnection { port: serial });
    Ok(EcuStatus { connected: true })
}

#[tauri::command]
fn disconnect(state: State<'_, AppState>) -> Result<EcuStatus, String> {
    let mut connection = state
        .connection
        .lock()
        .map_err(|_| "ECU connection state is unavailable".to_string())?;
    *connection = None;
    Ok(EcuStatus { connected: false })
}

#[tauri::command]
fn send_command(
    state: State<'_, AppState>,
    command: Vec<u8>,
    expected_size: usize,
) -> Result<Vec<u8>, String> {
    if command.is_empty() {
        return Err("ECU command must not be empty".to_string());
    }
    if !(1..=MAX_RESPONSE_SIZE).contains(&expected_size) {
        return Err(format!(
            "Expected response size must be between 1 and {MAX_RESPONSE_SIZE}"
        ));
    }

    let mut connection = state
        .connection
        .lock()
        .map_err(|_| "ECU connection state is unavailable".to_string())?;
    let connection = connection
        .as_mut()
        .ok_or_else(|| "ECU is not connected".to_string())?;

    connection
        .port
        .write_all(&command)
        .map_err(|error| format!("Unable to send ECU command: {error}"))?;
    thread::sleep(SERIAL_TIMEOUT);

    let mut response = Vec::with_capacity(expected_size);
    let mut byte = [0u8; 1];
    let mut retries = 0;
    while response.len() < expected_size {
        match connection.port.read(&mut byte) {
            Ok(0) => {
                retries += 1;
                if retries >= 5 {
                    break;
                }
                thread::sleep(SERIAL_TIMEOUT);
            }
            Ok(_) => {
                response.push(byte[0]);
                retries = 0;
            }
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
                ) =>
            {
                retries += 1;
                if retries >= 5 {
                    break;
                }
                thread::sleep(SERIAL_TIMEOUT);
            }
            Err(error) => return Err(format!("Unable to read ECU response: {error}")),
        }
    }

    if response.first() != Some(&command[0]) {
        return Err(format!(
            "ECU command echo mismatch: expected {:02X}, received {}",
            command[0],
            response
                .first()
                .map(|byte| format!("{byte:02X}"))
                .unwrap_or_else(|| "no data".to_string())
        ));
    }
    Ok(response)
}

fn normalize_port(mut port: String) -> String {
    for prefix in ["mems:", "loopback:", "file:"] {
        if let Some(stripped) = port.strip_prefix(prefix) {
            port = stripped.to_string();
            break;
        }
    }
    if port.contains("/dev/tty.") {
        port = port.replace("/dev/tty.", "/dev/cu.");
    }
    port
}

fn wake_mems_19(port: &mut dyn SerialPort) -> Result<(), String> {
    port.clear_break()
        .map_err(|error| format!("Unable to clear K-Line break: {error}"))?;
    thread::sleep(Duration::from_secs(2));

    let start = Instant::now();
    port.set_break()
        .map_err(|error| format!("Unable to send MEMS 1.9 start bit: {error}"))?;
    sleep_until(start, Duration::from_millis(200));

    let address = 0x16u8;
    for bit in 0..8 {
        if (address >> bit) & 1 == 1 {
            port.clear_break()
                .map_err(|error| format!("Unable to set K-Line high: {error}"))?;
        } else {
            port.set_break()
                .map_err(|error| format!("Unable to set K-Line low: {error}"))?;
        }
        sleep_until(start, Duration::from_millis(200 + (bit + 1) * 200));
    }
    port.clear_break()
        .map_err(|error| format!("Unable to send MEMS 1.9 stop bit: {error}"))?;
    sleep_until(start, Duration::from_millis(2_000));

    port.set_timeout(Duration::from_millis(10))
        .map_err(|error| format!("Unable to configure MEMS 1.9 wake-up timeout: {error}"))?;
    read_wakeup_frame(port, &[0x55, 0x76, 0x83])?;
    port.write_all(&[0x7c])
        .map_err(|error| format!("Unable to send MEMS 1.9 initialization command: {error}"))?;
    read_wakeup_frame(port, &[0x7c, 0xe9])?;
    port.set_timeout(SERIAL_TIMEOUT)
        .map_err(|error| format!("Unable to restore serial timeout: {error}"))?;
    Ok(())
}

fn read_wakeup_frame(port: &mut dyn SerialPort, expected: &[u8]) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(3);
    let mut frame = Vec::new();
    let mut buffer = [0u8; 128];
    while Instant::now() < deadline {
        match port.read(&mut buffer) {
            Ok(count) => frame.extend_from_slice(&buffer[..count]),
            Err(error)
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
                ) => {}
            Err(error) => return Err(format!("MEMS 1.9 wake-up read failed: {error}")),
        }
        while frame.first() == Some(&0) {
            frame.remove(0);
        }
        if frame == expected {
            return Ok(());
        }
        if !expected.starts_with(&frame) {
            frame.clear();
        }
    }
    Err(format!(
        "MEMS 1.9 wake-up timed out waiting for {:02X?}",
        expected
    ))
}

fn sleep_until(start: Instant, offset: Duration) {
    if let Some(remaining) = start
        .checked_add(offset)
        .and_then(|target| target.checked_duration_since(Instant::now()))
    {
        thread::sleep(remaining);
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_port;

    #[test]
    fn strips_reader_prefixes() {
        assert_eq!(normalize_port("mems:COM3".to_string()), "COM3");
        assert_eq!(
            normalize_port("loopback:/tmp/ttyecu".to_string()),
            "/tmp/ttyecu"
        );
    }

    #[test]
    fn converts_macos_tty_device_aliases() {
        assert_eq!(
            normalize_port("/dev/tty.usbserial-1".to_string()),
            "/dev/cu.usbserial-1"
        );
    }
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_available_ports,
            connect,
            disconnect,
            send_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running MemsSuite");
}
