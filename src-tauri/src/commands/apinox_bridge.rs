/// APInox bridge — Tauri commands for cross-app integration.
///
/// 1. Writes captured traffic into `~/.apinox/projects/APIprox Captures/`.
/// 2. Auto-syncs the APInox `network.proxy` setting so APInox routes through
///    the running APIprox proxy without any manual configuration.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use uuid::Uuid;

// ─────────────────────────────────────────────────────────────────────────────
// APInox proxy-config sync
// ─────────────────────────────────────────────────────────────────────────────

/// Returns `~/.apinox/config.jsonc`.
fn apinox_config_path() -> Result<PathBuf, String> {
    let home = dirs_next::home_dir()
        .ok_or_else(|| "Cannot determine home directory".to_string())?;
    Ok(home.join(".apinox").join("config.jsonc"))
}

/// Patch `network.proxy` in `~/.apinox/config.jsonc` to `http://127.0.0.1:{port}`.
///
/// The file is parsed as JSON (JSONC comments are stripped by ignoring lines
/// that start with `//`), modified, then written back as plain JSON.  Existing
/// comments in the file will be lost on the next write — that is acceptable
/// because APInox's `save_config` also writes plain JSON, not JSONC.
#[tauri::command]
pub async fn sync_apinox_proxy(port: u16) -> Result<(), String> {
    let path = apinox_config_path()?;

    let mut config: Value = if path.exists() {
        let raw = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read APInox config: {}", e))?;
        // Strip single-line comments before parsing
        let stripped: String = raw
            .lines()
            .map(|l| {
                if let Some(pos) = l.find("//") {
                    // Only strip if not inside a string — simple heuristic: no '"' before '//'
                    if !l[..pos].contains('"') {
                        return l[..pos].to_string();
                    }
                }
                l.to_string()
            })
            .collect::<Vec<_>>()
            .join("\n");
        serde_json::from_str(&stripped).unwrap_or(json!({}))
    } else {
        json!({})
    };

    let proxy_url = format!("http://127.0.0.1:{}", port);

    // Ensure network object exists
    if !config["network"].is_object() {
        config["network"] = json!({});
    }
    config["network"]["proxy"] = Value::String(proxy_url.clone());

    let out = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialise APInox config: {}", e))?;

    // Create parent dir if needed
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create .apinox directory: {}", e))?;
    }

    std::fs::write(&path, out)
        .map_err(|e| format!("Failed to write APInox config: {}", e))?;

    log::info!("[APInox Bridge] Set network.proxy = {}", proxy_url);
    Ok(())
}

/// Clear `network.proxy` in `~/.apinox/config.jsonc` (set to empty string).
#[tauri::command]
pub async fn clear_apinox_proxy() -> Result<(), String> {
    let path = apinox_config_path()?;
    if !path.exists() {
        return Ok(()); // Nothing to clear
    }

    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read APInox config: {}", e))?;
    let stripped: String = raw
        .lines()
        .map(|l| {
            if let Some(pos) = l.find("//") {
                if !l[..pos].contains('"') {
                    return l[..pos].to_string();
                }
            }
            l.to_string()
        })
        .collect::<Vec<_>>()
        .join("\n");

    let mut config: Value = serde_json::from_str(&stripped).unwrap_or(json!({}));

    if config["network"].is_object() {
        config["network"]["proxy"] = Value::String(String::new());
    }

    let out = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialise APInox config: {}", e))?;
    std::fs::write(&path, out)
        .map_err(|e| format!("Failed to write APInox config: {}", e))?;

    log::info!("[APInox Bridge] Cleared network.proxy");
    Ok(())
}

const CAPTURED_PROJECT_NAME: &str = "APIprox Captures";
const CAPTURED_FOLDER_NAME: &str = "Captured Traffic";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Returns `~/.apinox/projects/APIprox Captures/`.
fn captured_project_dir() -> Result<PathBuf, String> {
    let home = dirs_next::home_dir()
        .ok_or_else(|| "Cannot determine home directory".to_string())?;
    Ok(home.join(".apinox").join("projects").join(CAPTURED_PROJECT_NAME))
}

/// Ensure the captured project directory exists with a valid `properties.json`.
fn ensure_captured_project(dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;

    let props_path = dir.join("properties.json");
    if !props_path.exists() {
        let props = json!({
            "name": CAPTURED_PROJECT_NAME,
            "description": "HTTP traffic captured by APIprox",
            "id": Uuid::new_v4().to_string(),
            "format": "APInox-v1"
        });
        let content = serde_json::to_string_pretty(&props)
            .map_err(|e| format!("Failed to serialise properties: {}", e))?;
        std::fs::write(&props_path, content)
            .map_err(|e| format!("Failed to write properties.json: {}", e))?;
    }
    Ok(())
}

/// Build an `ApiRequest` JSON object from a `TrafficLog` (as Value).
fn traffic_log_to_request(log: &Value) -> Value {
    let method = log["method"].as_str().unwrap_or("POST").to_string();
    let url = log["url"].as_str().unwrap_or("").to_string();

    // Derive a human-readable request name: "METHOD /path"
    let path = {
        if let Some(after_scheme) = url.find("://").map(|i| &url[i + 3..]) {
            if let Some(slash) = after_scheme.find('/') {
                after_scheme[slash..].to_string()
            } else {
                "/".to_string()
            }
        } else {
            url.clone()
        }
    };
    let name = format!("{} {}", method, path);

    // Content-Type: look in request headers, default to text/xml
    let content_type = {
        let headers = &log["requestHeaders"];
        let ct = headers.get("content-type")
            .or_else(|| headers.get("Content-Type"))
            .or_else(|| headers.get("CONTENT-TYPE"))
            .and_then(|v| v.as_str())
            .unwrap_or("text/xml");
        ct.split(';').next().unwrap_or(ct).trim().to_string()
    };

    let request_body = log["requestBody"].as_str().unwrap_or("").to_string();
    let request_headers = log["requestHeaders"].clone();
    let headers_obj = if request_headers.is_object() { request_headers } else { json!({}) };

    json!({
        "id": Uuid::new_v4().to_string(),
        "name": name,
        "request": request_body,
        "endpoint": url,
        "method": method,
        "contentType": content_type,
        "headers": headers_obj,
        "assertions": [],
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tauri command
// ─────────────────────────────────────────────────────────────────────────────

/// Add a captured `TrafficLog` to the "Captured Traffic" folder of the shared
/// `~/.apinox/projects/APIprox Captures/` project.  The project is created
/// automatically if it does not yet exist.  APInox will auto-load it on next
/// startup (via `list_projects`).
#[tauri::command]
pub async fn add_traffic_to_apinox(log: Value) -> Result<String, String> {
    let project_path = captured_project_dir()?;

    // Ensure the project folder and properties.json exist
    ensure_captured_project(&project_path)?;

    // ── Build the ApiRequest to add ─────────────────────────────────────────
    let request = traffic_log_to_request(&log);

    // ── Find or create the "Captured Traffic" folder file ───────────────────
    let folders_dir = project_path.join("folders");
    std::fs::create_dir_all(&folders_dir)
        .map_err(|e| format!("Failed to create folders/ directory: {}", e))?;

    let mut folder_files: Vec<PathBuf> = {
        let entries = std::fs::read_dir(&folders_dir)
            .map_err(|e| format!("Failed to read folders/ dir: {}", e))?;
        let mut v: Vec<_> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("json"))
            .collect();
        v.sort();
        v
    };

    let mut found_path: Option<PathBuf> = None;
    for fp in &folder_files {
        if let Ok(raw) = std::fs::read_to_string(fp) {
            if let Ok(folder) = serde_json::from_str::<Value>(&raw) {
                if folder["name"].as_str() == Some(CAPTURED_FOLDER_NAME) {
                    found_path = Some(fp.clone());
                    break;
                }
            }
        }
    }

    if let Some(path) = found_path {
        // Append to existing folder
        let raw = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read folder file: {}", e))?;
        let mut folder: Value = serde_json::from_str(&raw)
            .map_err(|e| format!("Failed to parse folder file: {}", e))?;
        folder["requests"]
            .as_array_mut()
            .ok_or("Folder 'requests' is not an array")?
            .push(request);
        let out = serde_json::to_string_pretty(&folder)
            .map_err(|e| format!("Failed to serialise folder: {}", e))?;
        std::fs::write(&path, out)
            .map_err(|e| format!("Failed to write folder file: {}", e))?;
    } else {
        // Create new "Captured Traffic" folder file
        let new_index = folder_files.len() + 1;
        let filename = format!("{:03}_folder.json", new_index);
        let new_path = folders_dir.join(&filename);
        let folder = json!({
            "id": Uuid::new_v4().to_string(),
            "name": CAPTURED_FOLDER_NAME,
            "requests": [request],
            "expanded": true,
        });
        let out = serde_json::to_string_pretty(&folder)
            .map_err(|e| format!("Failed to serialise new folder: {}", e))?;
        std::fs::write(&new_path, out)
            .map_err(|e| format!("Failed to write new folder file: {}", e))?;
        folder_files.push(new_path);
    }

    log::info!(
        "[APInox Bridge] Added {} {} to '{}'",
        log["method"].as_str().unwrap_or("?"),
        log["url"].as_str().unwrap_or("?"),
        CAPTURED_FOLDER_NAME,
    );

    Ok(format!(
        "Request saved to '{}' in APInox.",
        CAPTURED_FOLDER_NAME,
    ))
}
