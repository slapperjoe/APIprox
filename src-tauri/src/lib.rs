use log::info;
use std::sync::Arc;
use tauri::Manager;

pub mod models;
pub mod proxy;
pub mod mock;
pub mod replacer;
pub mod breakpoint;
pub mod filewatcher;
pub mod certificates;
pub mod storage;
pub mod commands;

use certificates::manager::CertManager;
use storage::rules::RulesStorage;

/// Global app state — all services live here and are managed by Tauri.
pub struct AppState {
    pub proxy: proxy::state::SharedProxyState,
    pub mock: mock::state::SharedMockState,
    pub replacer: replacer::service::SharedReplacerService,
    pub breakpoint: breakpoint::service::SharedBreakpointService,
    pub filewatcher: filewatcher::service::SharedFileWatcherService,
    pub storage: Arc<RulesStorage>,
    pub cert_manager: Arc<CertManager>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            info!("APIprox starting (version: {})", app.package_info().version);

            // Resolve ~/.apiprox config directory
            let config_dir = dirs_next::home_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join(".apiprox");
            std::fs::create_dir_all(&config_dir).ok();

            let storage = Arc::new(RulesStorage::new(config_dir.clone()));

            // Build services, pre-loading persisted rules
            let replacer = replacer::service::new_shared();
            {
                let mut svc = replacer.lock().unwrap();
                for rule in storage.load_replace_rules() {
                    svc.add_rule(rule);
                }
            }

            let breakpoint = breakpoint::service::new_shared();
            {
                let mut svc = breakpoint.blocking_lock();
                svc.set_rules(storage.load_breakpoint_rules());
            }

            let filewatcher = filewatcher::service::new_shared();
            {
                let mut svc = filewatcher.blocking_lock();
                for watch in storage.load_file_watches() {
                    svc.add_watch(watch);
                }
            }

            let mock = mock::state::new_shared();
            {
                let mut state = mock.blocking_lock();
                state.config.rules = storage.load_mock_rules();
            }

            // Ensure CA cert exists
            let cert_manager = Arc::new(CertManager::new(config_dir.clone()));
            if !cert_manager.info().exists {
                if let Err(e) = cert_manager.generate() {
                    log::warn!("[Setup] Failed to generate CA certificate: {}", e);
                }
            }

            // Register global state
            app.manage(AppState {
                proxy: proxy::state::new_shared(),
                mock,
                replacer,
                breakpoint,
                filewatcher: filewatcher.clone(),
                storage,
                cert_manager,
            });

            // Re-spawn file watchers for any persisted watches
            {
                let watches = filewatcher.blocking_lock().get_watches();
                for watch in watches {
                    commands::filewatcher::spawn_watcher(watch, filewatcher.clone(), app.handle().clone());
                }
            }

            Ok(())
        })
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            // Proxy
            commands::proxy::start_proxy,
            commands::proxy::stop_proxy,
            commands::proxy::get_proxy_status,
            // Mock server
            commands::mock::start_mock,
            commands::mock::stop_mock,
            commands::mock::get_mock_status,
            commands::mock::get_mock_rules,
            commands::mock::add_mock_rule,
            commands::mock::update_mock_rule,
            commands::mock::delete_mock_rule,
            commands::mock::set_mock_record_mode,
            commands::mock::save_mock_rules,
            commands::mock::export_mock_collection,
            commands::mock::import_mock_collection,
            // Replace rules
            commands::replacer::get_replace_rules,
            commands::replacer::add_replace_rule,
            commands::replacer::update_replace_rule,
            commands::replacer::delete_replace_rule,
            // Breakpoints
            commands::breakpoint::get_breakpoint_rules,
            commands::breakpoint::set_breakpoint_rules,
            commands::breakpoint::add_breakpoint_rule,
            commands::breakpoint::delete_breakpoint_rule,
            commands::breakpoint::get_paused_traffic,
            commands::breakpoint::continue_breakpoint,
            commands::breakpoint::drop_breakpoint,
            // File watcher
            commands::filewatcher::get_file_watches,
            commands::filewatcher::add_file_watch,
            commands::filewatcher::update_file_watch,
            commands::filewatcher::delete_file_watch,
            commands::filewatcher::get_soap_pairs,
            commands::filewatcher::get_watcher_events,
            commands::filewatcher::clear_watcher_events,
            // Certificates
            commands::certificates::get_certificate_info,
            commands::certificates::generate_certificate,
            commands::certificates::trust_certificate,
            commands::certificates::untrust_certificate,
            // Sniffer / system proxy
            commands::sniffer::get_system_proxy_status,
            commands::sniffer::set_system_proxy,
            commands::sniffer::clear_system_proxy,
        ])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Clear the OS system proxy so traffic isn't left routing through
                // a dead port after the app exits.
                commands::sniffer::clear_on_exit();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

