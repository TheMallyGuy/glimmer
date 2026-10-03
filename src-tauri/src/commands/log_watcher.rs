use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_helper::auto_collect_command;

const POLL_INTERVAL: Duration = Duration::from_millis(300);

/// keeps poller threads alive: each stop flag tells its thread to exit
#[derive(Default)]
pub struct LogWatcherRegistry(Mutex<HashMap<String, Arc<AtomicBool>>>);

#[derive(Clone, Serialize)]
pub struct LogLineEvent {
    path: String,
    line: String,
}

struct TailState {
    file_path: Option<PathBuf>,
    offset: u64,
    partial: String,
}

/// the most recently modified file directly inside `dir`, if any
fn latest_file_in(dir: &Path) -> Option<PathBuf> {
    let mut latest: Option<(SystemTime, PathBuf)> = None;

    for entry in fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Ok(modified) = entry.metadata().and_then(|m| m.modified()) else {
            continue;
        };

        if latest.as_ref().is_none_or(|(t, _)| modified > *t) {
            latest = Some((modified, path));
        }
    }

    latest.map(|(_, path)| path)
}

/// read whatever's been appended to the tailed file since `state.offset` and
/// emit each complete line, buffering any trailing partial line for next time
fn tail_new_content(app: &AppHandle, state: &mut TailState) {
    let Some(path) = state.file_path.clone() else {
        return;
    };

    let mut file = match File::open(&path) {
        Ok(f) => f,
        Err(e) => {
            tauri_plugin_log::log::warn!("log_watcher: failed to open {:?}: {e}", path);
            return;
        }
    };
    if file.seek(SeekFrom::Start(state.offset)).is_err() {
        return;
    }

    let mut buf = Vec::new();
    if let Err(e) = file.read_to_end(&mut buf) {
        tauri_plugin_log::log::warn!("log_watcher: failed to read {:?}: {e}", path);
        return;
    }
    if buf.is_empty() {
        return;
    }

    state.offset += buf.len() as u64;
    state.partial.push_str(&String::from_utf8_lossy(&buf));

    while let Some(idx) = state.partial.find('\n') {
        let line: String = state.partial.drain(..=idx).collect();
        let line = line.trim_end_matches(['\r', '\n']).to_string();

        let _ = app.emit(
            "roblox-log-line",
            LogLineEvent {
                path: path.to_string_lossy().to_string(),
                line,
            },
        );
    }
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn watch_latest_log(
    app: AppHandle,
    registry: State<'_, LogWatcherRegistry>,
    dir: String,
) -> Result<(), String> {
    let mut watchers = registry.0.lock().map_err(|e| e.to_string())?;

    if watchers.contains_key(&dir) {
        return Ok(());
    }

    let stop = Arc::new(AtomicBool::new(false));
    let stop_thread = stop.clone();
    let dir_path = PathBuf::from(&dir);

    thread::spawn(move || {
        let initial_path = latest_file_in(&dir_path);
        let initial_offset = initial_path
            .as_ref()
            .and_then(|p| fs::metadata(p).ok())
            .map(|m| m.len())
            .unwrap_or(0);

        let mut state = TailState {
            file_path: initial_path,
            offset: initial_offset,
            partial: String::new(),
        };

        while !stop_thread.load(Ordering::Relaxed) {
            thread::sleep(POLL_INTERVAL);

            match latest_file_in(&dir_path) {
                Some(latest) => {
                    if state.file_path.as_ref() != Some(&latest) {
                        tauri_plugin_log::log::info!(
                            "log_watcher: switching to {:?} (was {:?})",
                            latest,
                            state.file_path
                        );
                        state.file_path = Some(latest);
                        state.offset = 0;
                        state.partial.clear();
                    }
                }
                None => {
                    tauri_plugin_log::log::warn!(
                        "log_watcher: latest_file_in returned None for {:?}",
                        dir_path
                    );
                }
            }

            tail_new_content(&app, &mut state);
        }
        tauri_plugin_log::log::warn!("log_watcher: poll thread exiting for {:?}", dir_path);
    });

    watchers.insert(dir, stop);

    Ok(())
}

/// stop watching a log directory previously passed to `watch_latest_log`
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn unwatch_latest_log(
    registry: State<'_, LogWatcherRegistry>,
    dir: String,
) -> Result<(), String> {
    let mut watchers = registry.0.lock().map_err(|e| e.to_string())?;
    if let Some(stop) = watchers.remove(&dir) {
        stop.store(true, Ordering::Relaxed);
    }
    Ok(())
}
