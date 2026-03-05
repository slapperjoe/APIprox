use serde::Serialize;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::mock::server::run_mock;
use crate::models::MockRule;
use crate::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MockStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub rule_count: usize,
    pub record_mode: bool,
}

#[tauri::command]
pub async fn start_mock(
    port: u16,
    target_url: String,
    passthrough_enabled: bool,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let mut ms = state.mock.lock().await;

    if ms.running {
        return Err("Mock server is already running".to_string());
    }

    ms.config.port = port;
    ms.config.target_url = target_url;
    ms.config.passthrough_enabled = passthrough_enabled;
    ms.config.enabled = true;

    let mock_state = state.mock.clone();
    let handle = tokio::spawn(async move {
        if let Err(e) = run_mock(mock_state, app).await {
            log::error!("[Mock] Server error: {}", e);
        }
    });

    ms.task = Some(handle.abort_handle());
    ms.running = true;

    log::info!("[Mock] Started on port {}", ms.config.port);
    Ok(())
}

#[tauri::command]
pub async fn stop_mock(state: State<'_, AppState>) -> Result<(), String> {
    let mut ms = state.mock.lock().await;
    if let Some(handle) = ms.task.take() {
        handle.abort();
    }
    ms.running = false;
    log::info!("[Mock] Stopped");
    Ok(())
}

#[tauri::command]
pub async fn get_mock_status(state: State<'_, AppState>) -> Result<MockStatus, String> {
    let ms = state.mock.lock().await;
    Ok(MockStatus {
        running: ms.running,
        port: if ms.running { Some(ms.config.port) } else { None },
        rule_count: ms.config.rules.len(),
        record_mode: ms.config.record_mode,
    })
}

#[tauri::command]
pub async fn get_mock_rules(state: State<'_, AppState>) -> Result<Vec<MockRule>, String> {
    Ok(state.mock.lock().await.config.rules.clone())
}

#[tauri::command]
pub async fn add_mock_rule(
    rule: MockRule,
    state: State<'_, AppState>,
) -> Result<MockRule, String> {
    let rule = if rule.id.is_empty() {
        MockRule { id: Uuid::new_v4().to_string(), ..rule }
    } else {
        rule
    };
    state.mock.lock().await.config.rules.push(rule.clone());
    save_rules(&state).await?;
    Ok(rule)
}

#[tauri::command]
pub async fn update_mock_rule(
    id: String,
    rule: MockRule,
    state: State<'_, AppState>,
) -> Result<MockRule, String> {
    let mut ms = state.mock.lock().await;
    match ms.config.rules.iter_mut().find(|r| r.id == id) {
        Some(r) => {
            *r = rule.clone();
            drop(ms);
            save_rules(&state).await?;
            Ok(rule)
        }
        None => Err(format!("Mock rule '{}' not found", id)),
    }
}

#[tauri::command]
pub async fn delete_mock_rule(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut ms = state.mock.lock().await;
    let before = ms.config.rules.len();
    ms.config.rules.retain(|r| r.id != id);
    if ms.config.rules.len() == before {
        Err(format!("Mock rule '{}' not found", id))
    } else {
        drop(ms);
        save_rules(&state).await?;
        Ok(())
    }
}

async fn save_rules(state: &AppState) -> Result<(), String> {
    let rules = state.mock.lock().await.config.rules.clone();
    state.storage.save_mock_rules(&rules).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_mock_record_mode(
    enabled: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.mock.lock().await.config.record_mode = enabled;
    Ok(())
}

/// Persist mock rules to disk. Called from the webview after mutations.
#[tauri::command]
pub async fn save_mock_rules(state: State<'_, AppState>) -> Result<(), String> {
    let rules = state.mock.lock().await.config.rules.clone();
    state
        .storage
        .save_mock_rules(&rules)
        .map_err(|e| e.to_string())
}
