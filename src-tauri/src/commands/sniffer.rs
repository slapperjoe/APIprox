use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::State;

use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemProxyStatus {
    pub enabled: bool,
    pub host: String,
    pub port: Option<u16>,
    /// "windows" | "macos" | "linux" | "unknown"
    pub platform: String,
    /// Whether automation is supported on this platform (Windows only)
    pub automation_supported: bool,
}

/// Get the current system HTTP proxy configuration.
#[tauri::command]
pub async fn get_system_proxy_status(_state: State<'_, AppState>) -> Result<SystemProxyStatus, String> {
    #[cfg(target_os = "windows")]
    {
        get_system_proxy_windows()
    }
    #[cfg(target_os = "macos")]
    {
        Ok(SystemProxyStatus {
            enabled: false,
            host: String::new(),
            port: None,
            platform: "macos".to_string(),
            automation_supported: false,
        })
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        // Check HTTPS_PROXY / HTTP_PROXY env vars as a best-effort read
        let proxy_env = std::env::var("HTTPS_PROXY")
            .or_else(|_| std::env::var("HTTP_PROXY"))
            .unwrap_or_default();
        let enabled = !proxy_env.is_empty();
        Ok(SystemProxyStatus {
            enabled,
            host: proxy_env,
            port: None,
            platform: "linux".to_string(),
            automation_supported: false,
        })
    }
}

/// Set the system HTTP+HTTPS proxy to 127.0.0.1:{port} (Windows only).
#[tauri::command]
pub async fn set_system_proxy(port: u16, _state: State<'_, AppState>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        set_proxy_windows(port)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("System proxy automation is only supported on Windows. Set HTTPS_PROXY=http://localhost:{port} manually.".to_string())
    }
}

/// Clear the system HTTP+HTTPS proxy (Windows only).
#[tauri::command]
pub async fn clear_system_proxy(_state: State<'_, AppState>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        clear_proxy_windows()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("System proxy automation is only supported on Windows.".to_string())
    }
}

// ── Windows implementation ──────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn get_system_proxy_windows() -> Result<SystemProxyStatus, String> {
    // Read from the Windows registry (HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings)
    // using the `reg` command — no extra crate needed.
    let output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v", "ProxyEnable",
        ])
        .output()
        .map_err(|e| format!("Failed to query registry: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let enabled = stdout.contains("0x1");

    let server_output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v", "ProxyServer",
        ])
        .output()
        .map_err(|e| format!("Failed to query registry ProxyServer: {}", e))?;

    let server_stdout = String::from_utf8_lossy(&server_output.stdout);
    // Parse "    ProxyServer    REG_SZ    127.0.0.1:8888"
    let proxy_server = server_stdout
        .lines()
        .find(|l| l.contains("ProxyServer"))
        .and_then(|l| l.split_whitespace().last())
        .unwrap_or("")
        .to_string();

    let (host, port) = parse_proxy_server(&proxy_server);

    Ok(SystemProxyStatus {
        enabled,
        host,
        port,
        platform: "windows".to_string(),
        automation_supported: true,
    })
}

#[cfg(target_os = "windows")]
fn set_proxy_windows(port: u16) -> Result<(), String> {
    let proxy_value = format!("127.0.0.1:{}", port);

    // Enable proxy and set server via registry
    run_reg_add(
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
        "ProxyServer",
        "REG_SZ",
        &proxy_value,
    )?;
    run_reg_add(
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
        "ProxyEnable",
        "REG_DWORD",
        "1",
    )?;

    // Notify WinInet of the change so it takes effect without a reboot
    notify_proxy_change_windows();

    log::info!("[Sniffer] System proxy set to {}", proxy_value);
    Ok(())
}

#[cfg(target_os = "windows")]
fn clear_proxy_windows() -> Result<(), String> {
    run_reg_add(
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
        "ProxyEnable",
        "REG_DWORD",
        "0",
    )?;

    notify_proxy_change_windows();

    log::info!("[Sniffer] System proxy cleared");
    Ok(())
}

#[cfg(target_os = "windows")]
fn run_reg_add(key: &str, value_name: &str, value_type: &str, data: &str) -> Result<(), String> {
    let output = Command::new("reg")
        .args(["add", key, "/v", value_name, "/t", value_type, "/d", data, "/f"])
        .output()
        .map_err(|e| format!("reg add failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("reg add error: {}", stderr));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn notify_proxy_change_windows() {
    // Run a tiny PowerShell snippet to call InternetSetOption with
    // INTERNET_OPTION_SETTINGS_CHANGED (39) and INTERNET_OPTION_REFRESH (37)
    // so WinInet / IE-based apps pick up the change immediately.
    let _ = Command::new("powershell")
        .args([
            "-NoProfile", "-NonInteractive", "-Command",
            r#"
$code = @'
[DllImport("wininet.dll", SetLastError = true, CharSet = CharSet.Auto)]
public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
'@
$type = Add-Type -MemberDefinition $code -Name WinInet -Namespace Proxy -PassThru
$type::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null
$type::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null
"#,
        ])
        .output()
        .ok();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn parse_proxy_server(server: &str) -> (String, Option<u16>) {
    // Handles "127.0.0.1:8888" or "http=127.0.0.1:8888;https=127.0.0.1:8888"
    let clean = server
        .split(';')
        .next()
        .unwrap_or(server)
        .trim_start_matches("http=")
        .trim_start_matches("https=");

    if let Some((host, port_str)) = clean.rsplit_once(':') {
        let port = port_str.parse::<u16>().ok();
        (host.to_string(), port)
    } else {
        (clean.to_string(), None)
    }
}
