use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::models::{FileWatch, WatcherEvent};
use crate::AppState;

#[tauri::command]
pub async fn get_file_watches(state: State<'_, AppState>) -> Result<Vec<FileWatch>, String> {
    Ok(state.filewatcher.lock().await.get_watches())
}

#[tauri::command]
pub async fn add_file_watch(
    watch: FileWatch,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<FileWatch, String> {
    let watch = if watch.id.is_empty() {
        FileWatch { id: Uuid::new_v4().to_string(), ..watch }
    } else {
        watch
    };
    let mut svc = state.filewatcher.lock().await;
    svc.add_watch(watch.clone());
    let watches = svc.get_watches();
    drop(svc);
    state.storage.save_file_watches(&watches).map_err(|e| e.to_string())?;
    // Spawn a watcher for this path
    spawn_watcher(watch.clone(), state.filewatcher.clone(), app);
    Ok(watch)
}

#[tauri::command]
pub async fn update_file_watch(
    id: String,
    watch: FileWatch,
    state: State<'_, AppState>,
) -> Result<FileWatch, String> {
    let mut svc = state.filewatcher.lock().await;
    let updated = svc.update_watch(&id, watch.clone());
    if updated {
        let watches = svc.get_watches();
        drop(svc);
        state.storage.save_file_watches(&watches).map_err(|e| e.to_string())?;
        Ok(watch)
    } else {
        Err(format!("File watch '{}' not found", id))
    }
}

#[tauri::command]
pub async fn delete_file_watch(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut svc = state.filewatcher.lock().await;
    let deleted = svc.delete_watch(&id);
    if deleted {
        let watches = svc.get_watches();
        drop(svc);
        state.storage.save_file_watches(&watches).map_err(|e| e.to_string())
    } else {
        Err(format!("File watch '{}' not found", id))
    }
}

#[tauri::command]
pub async fn get_watcher_events(
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<WatcherEvent>, String> {
    Ok(state.filewatcher.lock().await.get_events(limit))
}

#[tauri::command]
pub async fn clear_watcher_events(state: State<'_, AppState>) -> Result<(), String> {
    state.filewatcher.lock().await.clear_events();
    Ok(())
}

/// Spawn a notify watcher for a single FileWatch entry.
pub fn spawn_watcher(
    watch: FileWatch,
    svc: crate::filewatcher::service::SharedFileWatcherService,
    app: AppHandle,
) {
    use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
    use std::path::Path;

    if !watch.enabled {
        return;
    }

    let path = watch.path.clone();
    let watch_id = watch.id.clone();
    let watch_name = watch.name.clone();

    tokio::spawn(async move {
        let (tx, mut rx) = tokio::sync::mpsc::channel(32);

        let mut watcher = match RecommendedWatcher::new(
            move |res: notify::Result<notify::Event>| {
                if let Ok(event) = res {
                    let _ = tx.blocking_send(event);
                }
            },
            Config::default(),
        ) {
            Ok(w) => w,
            Err(e) => {
                log::warn!("[FileWatcher] Failed to create watcher for {}: {}", path, e);
                return;
            }
        };

        if let Err(e) = watcher.watch(Path::new(&path), RecursiveMode::Recursive) {
            log::warn!("[FileWatcher] Failed to watch {}: {}", path, e);
            return;
        }

        log::info!("[FileWatcher] Watching: {}", path);

        while let Some(event) = rx.recv().await {
            let kind_str = match event.kind {
                notify::EventKind::Create(_) => "created",
                notify::EventKind::Modify(_) => "modified",
                notify::EventKind::Remove(_) => "deleted",
                notify::EventKind::Access(_) => continue, // skip access events
                _ => "modified",
            };

            for file_path in &event.paths {
                let we = WatcherEvent {
                    id: Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().timestamp_millis(),
                    watch_id: watch_id.clone(),
                    watch_name: watch_name.clone(),
                    file_path: file_path.to_string_lossy().into_owned(),
                    event_kind: kind_str.to_string(),
                };

                svc.lock().await.add_event(we.clone());
                if let Err(e) = app.emit("watcher-event", &we) {
                    log::warn!("[FileWatcher] Failed to emit event: {}", e);
                }
            }
        }
    });
}
