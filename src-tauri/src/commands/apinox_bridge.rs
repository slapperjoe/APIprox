/// APInox bridge — Tauri commands for cross-app integration.
///
/// Writes captured traffic directly into a dedicated APInox project
/// (`~/.apinox/projects/APIprox Captures/`) that APInox auto-loads on startup.
/// No folder picker needed — works silently in the background.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use uuid::Uuid;

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
