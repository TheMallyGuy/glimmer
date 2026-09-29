use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};
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
        // must be registered first: it's what lets a second launch hand off to this
        // one instead of starting a whole separate process
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_existing_instance(app);
        }))
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
            commands::start_discord_rpc_at_boot(app.handle());

            let open_selector =
                MenuItem::with_id(app, "open_selector", "Open selector", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_selector, &quit])?;

            let logs_dir = app.path().local_data_dir()?.join("Roblox").join("logs");

            if let Err(e) = commands::watch_latest_log(
                app.handle().clone(),
                app.state::<LogWatcherRegistry>(),
                logs_dir.to_string_lossy().to_string(),
            ) {
                tauri_plugin_log::log::error!("failed to start log watcher: {e}");
            }

            WebviewWindowBuilder::new(app, "background", WebviewUrl::App("/background".into()))
                .visible(false)
                .skip_taskbar(true)
                .decorations(false)
                .inner_size(1.0, 1.0)
                .build()?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Glimmer")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open_selector" => open_selector_window(app),

                    "quit" => std::process::exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        focus_existing_instance(tray.app_handle());
                    }
                })
                .build(app)?;

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
