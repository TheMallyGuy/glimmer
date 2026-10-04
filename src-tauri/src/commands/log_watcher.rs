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

/// a log of the player. The folder holds other logs too, like the crash handler's (which Roblox writes to on its own
/// and which is not what the log rules are about) and Studio's.
fn is_player_log(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.contains("_Player_") && !name.contains("CrashHandler"))
}

/// the player log that was modified last in `dir`, if any
fn latest_file_in(dir: &Path) -> Option<PathBuf> {
    let mut latest: Option<(SystemTime, PathBuf)> = None;

    for entry in fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        if !path.is_file() || !is_player_log(&path) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn only_player_logs_are_followed() {
        assert!(is_player_log(Path::new("0.741.0.7411058_20261004T101409Z_Player_5578E_last.log")));
        assert!(!is_player_log(Path::new("0.741.0.7411058_20261004T033436Z_Player_914ED_CrashHandler_last.log")));
        assert!(!is_player_log(Path::new("0.741.0.7411058_20261004T033436Z_Studio_914ED_last.log")));
        assert!(!is_player_log(Path::new("notes.txt")));
    }

    /// The watcher used to follow whichever file was written last, so when the crash handler's log (or another
    /// player log) was written after the player log, it switched files and read the whole log again from the start:
    /// every join in it was handled a second time.
    #[test]
    fn a_newer_crash_handler_log_does_not_take_the_place_of_the_player_log() {
        let dir = std::env::temp_dir().join(format!("glimmer-{}-watcher", std::process::id()));
        fs::create_dir_all(&dir).unwrap();

        let player = dir.join("0.741.0.7411058_20261004T153422Z_Player_33E70_last.log");
        fs::write(&player, "joins").unwrap();
        std::thread::sleep(Duration::from_millis(30));
        fs::write(dir.join("0.741.0.7411058_20261004T153423Z_Player_914ED_CrashHandler_last.log"), "crash").unwrap();
        std::thread::sleep(Duration::from_millis(30));
        fs::write(dir.join("0.741.0.7411058_20261004T153424Z_Studio_AAAAA_last.log"), "studio").unwrap();

        let latest = latest_file_in(&dir);

        let _ = fs::remove_dir_all(&dir);
        assert_eq!(latest, Some(player));
    }

    #[test]
    fn a_newer_player_log_takes_over() {
        let dir = std::env::temp_dir().join(format!("glimmer-{}-watcher2", std::process::id()));
        fs::create_dir_all(&dir).unwrap();

        fs::write(dir.join("1_Player_AAAAA_last.log"), "old").unwrap();
        std::thread::sleep(Duration::from_millis(30));
        let newer = dir.join("2_Player_BBBBB_last.log");
        fs::write(&newer, "new").unwrap();

        let latest = latest_file_in(&dir);

        let _ = fs::remove_dir_all(&dir);
        assert_eq!(latest, Some(newer));
    }

    #[test]
    fn a_folder_with_no_player_log_has_none() {
        let dir = std::env::temp_dir().join(format!("glimmer-{}-watcher3", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("1_Player_AAAAA_CrashHandler_last.log"), "crash").unwrap();

        let latest = latest_file_in(&dir);

        let _ = fs::remove_dir_all(&dir);
        assert_eq!(latest, None);
        assert_eq!(latest_file_in(&dir.join("missing")), None);
    }
}
