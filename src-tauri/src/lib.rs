use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_helper::{auto_collect_command, specta_collect_commands};
pub mod commands;
pub use commands::*;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new().commands(specta_collect_commands!())
}

// see https://github.com/fishstrap/fishstrap/commit/988db40e3e259489f95e4c7ec40f8dbf5685f309
fn vng_distribution_enabled_in_config(app: &AppHandle) -> bool {
    let Ok(app_data_dir) = app.path().app_data_dir() else {
        return false;
    };

    let Ok(contents) = std::fs::read_to_string(app_data_dir.join("config.json")) else {
        return false;
    };

    let Ok(config) = serde_json::from_str::<serde_json::Value>(&contents) else {
        return false;
    };

    config["installations"]["vngDistribution"]["enabled"]
        .as_bool()
        .unwrap_or(false)
}

// focus the chooser window if it's already open, otherwise create it
fn open_selector_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }

    let _ = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("/choose".into()))
        .title("glimmer")
        .inner_size(562.0, 322.0)
        .maximizable(false)
        .decorations(false)
        .resizable(false)
        .center()
        .build();
}

fn focus_existing_instance(app: &AppHandle) {
    for label in ["main", "splash"] {
        if let Some(win) = app.get_webview_window(label) {
            let _ = win.unminimize();
            let _ = win.show();
            let _ = win.set_focus();
            return;
        }
    }

    open_selector_window(app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_builder();

    #[cfg(debug_assertions)]
    builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/ts/bindings.ts",
        )
        .expect("failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let opened_by_link = args
                .iter()
                .skip(1)
                .any(|a| a.starts_with("roblox:") || a.starts_with("roblox-player:"));
            if opened_by_link {
                return;
            }

            let app = app.clone();
            tauri::async_runtime::spawn(async move { focus_existing_instance(&app) });
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(if cfg!(debug_assertions) {
                    tauri_plugin_log::log::LevelFilter::Debug
                } else {
                    tauri_plugin_log::log::LevelFilter::Info
                })
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(LogWatcherRegistry::default())
        .manage(commands::DiscordRpcState::default())
        .manage(commands::DiscordRpcDebugState::default())
        .setup(|app| {

            #[cfg(all(debug_assertions, any(windows, target_os = "linux")))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }

            commands::start_discord_rpc_at_boot(app.handle());

            let local_data_dir = app.path().local_data_dir()?;
            let mut logs_dirs = vec![local_data_dir.join("Roblox").join("logs")];

            if vng_distribution_enabled_in_config(app.handle()) {
                logs_dirs.push(local_data_dir.join("RobloxPCVNG").join("logs"));
            }

            for logs_dir in logs_dirs {
                if let Err(e) = commands::watch_latest_log(
                    app.handle().clone(),
                    app.state::<LogWatcherRegistry>(),
                    logs_dir.to_string_lossy().to_string(),
                ) {
                    tauri_plugin_log::log::error!(
                        "failed to start log watcher for {:?}: {e}",
                        logs_dir
                    );
                }
            }

            WebviewWindowBuilder::new(app, "background", WebviewUrl::App("/background".into()))
                .visible(false)
                .skip_taskbar(true)
                .decorations(false)
                .inner_size(1.0, 1.0)
                .build()?;

            // the tray icon is made by the frontend (see src/ts/tray.ts), in the background window above

            Ok(())
        })
        .invoke_handler(builder.invoke_handler())
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
