use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use discord_rich_presence::activity::{Activity, Assets, Button, Party, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_helper::auto_collect_command;

const DISCORD_CLIENT_ID: &str = "363445589247131668";
const RECONNECT_DELAY: Duration = Duration::from_secs(5);

#[derive(Default)]
pub struct DiscordRpcState {
    client: Mutex<Option<DiscordIpcClient>>,

    generation: AtomicU64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct DiscordActivityButton {
    pub label: String,
    pub url: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DiscordActivityPayload {
    pub details: Option<String>,
    pub state: Option<String>,
    pub start_timestamp: Option<f64>,
    pub end_timestamp: Option<f64>,
    pub large_image_key: Option<String>,
    pub large_image_text: Option<String>,
    pub small_image_key: Option<String>,
    pub small_image_text: Option<String>,
    pub buttons: Option<Vec<DiscordActivityButton>>,
    pub party_id: Option<String>,
    pub party_size: Option<u32>,
    pub party_max: Option<u32>,
    pub join_secret: Option<String>,
    pub spectate_secret: Option<String>,
    pub match_secret: Option<String>,
}

impl DiscordActivityPayload {
    fn to_activity(&self) -> Activity<'_> {
        let mut activity = Activity::new();

        if let Some(state) = self.state.as_deref() {
            activity = activity.state(state);
        }
        if let Some(details) = self.details.as_deref() {
            activity = activity.details(details);
        }

        if self.start_timestamp.is_some() || self.end_timestamp.is_some() {
            let mut timestamps = Timestamps::new();
            if let Some(start) = self.start_timestamp {
                timestamps = timestamps.start(start as i64);
            }
            if let Some(end) = self.end_timestamp {
                timestamps = timestamps.end(end as i64);
            }
            activity = activity.timestamps(timestamps);
        }

        if self.large_image_key.is_some()
            || self.large_image_text.is_some()
            || self.small_image_key.is_some()
            || self.small_image_text.is_some()
        {
            let mut assets = Assets::new();
            if let Some(v) = self.large_image_key.as_deref() {
                assets = assets.large_image(v);
            }
            if let Some(v) = self.large_image_text.as_deref() {
                assets = assets.large_text(v);
            }
            if let Some(v) = self.small_image_key.as_deref() {
                assets = assets.small_image(v);
            }
            if let Some(v) = self.small_image_text.as_deref() {
                assets = assets.small_text(v);
            }
            activity = activity.assets(assets);
        }

        if self.party_id.is_some() || self.party_size.is_some() {
            let mut party = Party::new();
            if let Some(v) = self.party_id.as_deref() {
                party = party.id(v);
            }
            if let (Some(size), Some(max)) = (self.party_size, self.party_max) {
                party = party.size([size as i32, max as i32]);
            }
            activity = activity.party(party);
        }

        if let Some(buttons) = self.buttons.as_ref() {
            let buttons = buttons
                .iter()
                .map(|b| Button::new(&b.label, &b.url))
                .collect();
            activity = activity.buttons(buttons);
        }

        activity
    }
}

fn emit_event(app: &AppHandle, event_type: &str, message: Option<String>) {
    let payload = serde_json::json!({ "type": event_type, "message": message }).to_string();
    let _ = app.emit("discord-rpc-event", payload);
}

fn discord_rpc_enabled_in_config(app: &AppHandle) -> bool {
    let Ok(app_data_dir) = app.path().app_data_dir() else {
        return false;
    };

    let Ok(contents) = std::fs::read_to_string(app_data_dir.join("config.json")) else {
        return false;
    };

    let Ok(config) = serde_json::from_str::<serde_json::Value>(&contents) else {
        return false;
    };

    config["integrations"]["discordRpc"]["enabled"]
        .as_bool()
        .unwrap_or(false)
}

fn spawn_login(app: AppHandle, state_handle: tauri::State<'_, DiscordRpcState>) {
    let generation = state_handle.generation.fetch_add(1, Ordering::SeqCst) + 1;

    thread::spawn(move || {
        let state = app.state::<DiscordRpcState>();

        loop {
            if state.generation.load(Ordering::SeqCst) != generation {
                return;
            }

            let mut client = match DiscordIpcClient::new(DISCORD_CLIENT_ID) {
                Ok(client) => client,
                Err(e) => {
                    emit_event(&app, "error", Some(e.to_string()));
                    return;
                }
            };

            match client.connect() {
                Ok(()) => {
                    tauri_plugin_log::log::info!("discord_rpc: connected");
                    let mut guard = state.client.lock().expect("discord rpc mutex poisoned");
                    if state.generation.load(Ordering::SeqCst) != generation {
                        let _ = client.close();
                        return;
                    }
                    *guard = Some(client);
                    drop(guard);
                    emit_event(&app, "connected", None);
                    return;
                }
                Err(e) => {
                    tauri_plugin_log::log::warn!(
                        "discord_rpc: connect attempt failed, retrying in {:?}: {e}",
                        RECONNECT_DELAY
                    );
                    emit_event(&app, "error", Some(e.to_string()));
                    thread::sleep(RECONNECT_DELAY);
                }
            }
        }
    });
}

pub fn start_discord_rpc_at_boot(app: &AppHandle) {
    if !discord_rpc_enabled_in_config(app) {
        return;
    }

    spawn_login(app.clone(), app.state::<DiscordRpcState>());
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn discord_rpc_login(
    app: AppHandle,
    state: tauri::State<'_, DiscordRpcState>,
) -> Result<(), String> {
    if state.client.lock().map_err(|e| e.to_string())?.is_some() {
        return Ok(());
    }

    spawn_login(app, state);
    Ok(())
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn discord_rpc_set_activity(
    state: tauri::State<'_, DiscordRpcState>,
    activity: DiscordActivityPayload,
) -> Result<(), String> {
    let mut guard = state.client.lock().map_err(|e| e.to_string())?;
    let Some(client) = guard.as_mut() else {
        return Ok(());
    };
    client
        .set_activity(activity.to_activity())
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn discord_rpc_clear_activity(state: tauri::State<'_, DiscordRpcState>) -> Result<(), String> {
    let mut guard = state.client.lock().map_err(|e| e.to_string())?;
    let Some(client) = guard.as_mut() else {
        return Ok(());
    };
    client.clear_activity().map_err(|e| e.to_string())
}

/// closes the Discord IPC connection and cancels any in-flight reconnect attempt
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn discord_rpc_stop(state: tauri::State<'_, DiscordRpcState>) -> Result<(), String> {
    state.generation.fetch_add(1, Ordering::SeqCst);

    let mut guard = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(mut client) = guard.take() {
        let _ = client.close();
    }
    Ok(())
}

#[derive(Default)]
pub struct DiscordRpcDebugState(Mutex<Option<DiscordIpcClient>>);

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn discord_rpc_debug_connect(
    state: tauri::State<'_, DiscordRpcDebugState>,
) -> Result<String, String> {
    let mut client = DiscordIpcClient::new(DISCORD_CLIENT_ID).map_err(|e| e.to_string())?;
    client.connect().map_err(|e| e.to_string())?;

    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = Some(client);
    Ok("connected".to_string())
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn discord_rpc_debug_set_test_activity(
    state: tauri::State<'_, DiscordRpcDebugState>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let client = guard
        .as_mut()
        .ok_or("not connected: call discord_rpc_debug_connect first")?;

    let activity = Activity::new()
        .state("Debug test")
        .details("Sent from discord_rpc_debug_set_test_activity");
    client.set_activity(activity).map_err(|e| e.to_string())
}

/// `true` if the debug connection is currently open
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn discord_rpc_debug_status(
    state: tauri::State<'_, DiscordRpcDebugState>,
) -> Result<bool, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.is_some())
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn discord_rpc_debug_stop(state: tauri::State<'_, DiscordRpcDebugState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut client) = guard.take() {
        let _ = client.close();
    }
    Ok(())
}
