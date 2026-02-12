use log::{info, error};
use tauri::{Manager, Emitter};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::State;

struct SidecarState {
    port: Mutex<Option<u16>>,
}

#[tauri::command]
fn get_sidecar_port(state: State<SidecarState>) -> Option<u16> {
    *state.port.lock().unwrap()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SidecarState {
            port: Mutex::new(None),
        })
        .setup(|app| {
            info!("APIprox starting (version: {})", app.package_info().version);
            
            // Get the sidecar binary path
            // In dev mode, use the project root sidecar-bundle directory
            // In production, use the resource directory
            let sidecar_binary = if cfg!(debug_assertions) {
                // Dev mode: Use project root
                std::env::current_dir()
                    .expect("Failed to get current dir")
                    .parent() // Go up from src-tauri to project root
                    .expect("Failed to get parent dir")
                    .join("sidecar-bundle")
                    .join(if cfg!(target_os = "windows") {
                        "sidecar-x86_64-pc-windows-msvc.exe"
                    } else if cfg!(target_os = "macos") {
                        "sidecar-x86_64-apple-darwin"
                    } else {
                        "sidecar-x86_64-unknown-linux-gnu"
                    })
            } else {
                // Production mode: Use resource directory
                app.path().resource_dir()
                    .expect("Failed to get resource dir")
                    .join("sidecar-bundle")
                    .join(if cfg!(target_os = "windows") {
                        "sidecar-x86_64-pc-windows-msvc.exe"
                    } else if cfg!(target_os = "macos") {
                        "sidecar-x86_64-apple-darwin"
                    } else {
                        "sidecar-x86_64-unknown-linux-gnu"
                    })
            };

            info!("Starting sidecar from: {:?}", sidecar_binary);

            // Verify binary exists
            if !sidecar_binary.exists() {
                error!("Sidecar binary not found at: {:?}", sidecar_binary);
                return Ok(());
            }

            // Start the sidecar process
            let mut child = Command::new(&sidecar_binary)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .expect("Failed to start sidecar");

            // Read the port from stdout
            if let Some(stdout) = child.stdout.take() {
                use std::io::{BufRead, BufReader};
                let reader = BufReader::new(stdout);
                
                // Get handles before moving into thread
                let app_handle = app.handle().clone();
                
                std::thread::spawn(move || {
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            println!("[Sidecar] {}", line);
                            
                            // Look for SIDECAR_PORT:XXXX
                            if line.starts_with("SIDECAR_PORT:") {
                                if let Ok(port) = line.replace("SIDECAR_PORT:", "").trim().parse::<u16>() {
                                    info!("Sidecar started on port: {}", port);
                                    
                                    // Store port in state
                                    let state = app_handle.state::<SidecarState>();
                                    *state.port.lock().unwrap() = Some(port);
                                    
                                    // Send port to webview - try different window labels
                                    let window = app_handle.get_webview_window("main")
                                        .or_else(|| app_handle.webview_windows().values().next().cloned());
                                    
                                    if let Some(window) = window {
                                        info!("Emitting sidecar-port event to window: {:?}", window.label());
                                        match window.emit("sidecar-port", port) {
                                            Ok(_) => info!("Successfully emitted sidecar-port event"),
                                            Err(e) => error!("Failed to emit sidecar-port event: {:?}", e),
                                        }
                                    } else {
                                        error!("No webview window found to emit sidecar-port event!");
                                    }
                                }
                            }
                        }
                    }
                });
            }
            
            // Keep child process handle so it doesn't get killed
            std::mem::forget(child);
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_sidecar_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
