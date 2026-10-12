use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

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

/// where reading stopped in one log, and the end of it that is not a whole line yet
struct Tail {
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


struct LogTails {
    files: HashMap<PathBuf, Tail>,
}

impl LogTails {
    /// What is in the folder now is history, which is not read: those logs are followed from their end.
    fn new(dir: &Path) -> Self {
        let mut files = HashMap::new();
        for (path, len) in player_logs(dir) {
            files.insert(path, Tail { offset: len, partial: String::new() });
        }
        LogTails { files }
    }

    /// the new complete lines of every log since the last poll, with the log each is from. A log that was not there
    /// before is a new one, and is read from its start.
    fn poll(&mut self, dir: &Path) -> Vec<(PathBuf, String)> {
        let mut lines = Vec::new();
        let present = player_logs(dir);

        // logs that were deleted need no more following
        self.files.retain(|path, _| present.iter().any(|(p, _)| p == path));

        for (path, len) in present {
            let tail = self
                .files
                .entry(path.clone())
                .or_insert_with(|| Tail { offset: 0, partial: String::new() });

            // a log that got shorter was started over
            if len < tail.offset {
                tail.offset = 0;
                tail.partial.clear();
            }
            if len == tail.offset {
                continue;
            }

            let Some(bytes) = read_from(&path, tail.offset) else {
                continue;
            };
            tail.offset += bytes.len() as u64;
            tail.partial.push_str(&String::from_utf8_lossy(&bytes));

            while let Some(idx) = tail.partial.find('\n') {
                let line: String = tail.partial.drain(..=idx).collect();
                lines.push((path.clone(), line.trim_end_matches(['\r', '\n']).to_string()));
            }
        }

        lines
    }
}


const FOLLOWED_LOGS: usize = 8;


fn player_logs(dir: &Path) -> Vec<(PathBuf, u64)> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };

    let mut paths: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| is_player_log(path))
        .collect();

    // the name starts with the version and the time the run started, so the newest sort last
    paths.sort();
    let skip = paths.len().saturating_sub(FOLLOWED_LOGS);

    paths
        .into_iter()
        .skip(skip)
        .filter_map(|path| {
            let meta = fs::metadata(&path).ok()?;
            meta.is_file().then(|| (path, meta.len()))
        })
        .collect()
}

/// what was written to a file after `offset`
fn read_from(path: &Path, offset: u64) -> Option<Vec<u8>> {
    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(e) => {
            tauri_plugin_log::log::warn!("log_watcher: failed to open {:?}: {e}", path);
            return None;
        }
    };
    file.seek(SeekFrom::Start(offset)).ok()?;

    let mut buf = Vec::new();
    if let Err(e) = file.read_to_end(&mut buf) {
        tauri_plugin_log::log::warn!("log_watcher: failed to read {:?}: {e}", path);
        return None;
    }
    Some(buf)
}

/// start following the logs in a Roblox log directory: each new line of any player log is emitted as a
/// `roblox-log-line` event
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
        let mut tails = LogTails::new(&dir_path);

        while !stop_thread.load(Ordering::Relaxed) {
            thread::sleep(POLL_INTERVAL);

            for (path, line) in tails.poll(&dir_path) {
                let _ = app.emit(
                    "roblox-log-line",
                    LogLineEvent {
                        path: path.to_string_lossy().to_string(),
                        line,
                    },
                );
            }
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
    use std::io::Write;

    /// a folder that is removed when the test ends
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("glimmer-{}-{name}", std::process::id()));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).unwrap();
            TempDir(dir)
        }

        fn path(&self) -> &Path {
            &self.0
        }

        fn write(&self, name: &str, text: &str) {
            fs::write(self.0.join(name), text).unwrap();
        }

        fn append(&self, name: &str, text: &str) {
            let mut file = fs::OpenOptions::new().append(true).open(self.0.join(name)).unwrap();
            file.write_all(text.as_bytes()).unwrap();
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    const A: &str = "0.741.0.7411058_20261005T044908Z_Player_AA148_last.log";
    const B: &str = "0.741.0.7411058_20261005T045032Z_Player_B9E1E_last.log";

    fn texts(lines: Vec<(PathBuf, String)>) -> Vec<String> {
        lines.into_iter().map(|(_, line)| line).collect()
    }

    #[test]
    fn only_player_logs_are_followed() {
        assert!(is_player_log(Path::new("0.741.0.7411058_20261004T101409Z_Player_5578E_last.log")));
        assert!(!is_player_log(Path::new("0.741.0.7411058_20261004T033436Z_Player_914ED_CrashHandler_last.log")));
        assert!(!is_player_log(Path::new("0.741.0.7411058_20261004T033436Z_Studio_914ED_last.log")));
        assert!(!is_player_log(Path::new("notes.txt")));
    }

    #[test]
    fn what_was_in_the_logs_before_is_history() {
        let dir = TempDir::new("history");
        dir.write(A, "old join\nold leave\n");

        let mut tails = LogTails::new(dir.path());

        assert_eq!(texts(tails.poll(dir.path())), Vec::<String>::new());
        dir.append(A, "new line\n");
        assert_eq!(texts(tails.poll(dir.path())), ["new line"]);
    }

    #[test]
    fn a_log_that_appears_later_is_read_from_its_start() {
        let dir = TempDir::new("new-log");
        let mut tails = LogTails::new(dir.path());

        dir.write(A, "first\nsecond\n");

        assert_eq!(texts(tails.poll(dir.path())), ["first", "second"]);
    }


    #[test]
    fn two_logs_written_in_turns_never_repeat_a_line() {
        let dir = TempDir::new("turns");
        let mut tails = LogTails::new(dir.path());
        let mut seen = Vec::new();

        dir.write(A, "join 1\n");
        seen.extend(texts(tails.poll(dir.path())));
        dir.append(A, "join 2\n");
        seen.extend(texts(tails.poll(dir.path())));

        // the hop: a second process with its own log
        dir.write(B, "startup\n");
        seen.extend(texts(tails.poll(dir.path())));
        // the first process writes again, and then the second
        dir.append(A, "join 3\n");
        seen.extend(texts(tails.poll(dir.path())));
        dir.append(B, "handover\n");
        seen.extend(texts(tails.poll(dir.path())));
        dir.append(A, "leave\n");
        seen.extend(texts(tails.poll(dir.path())));

        assert_eq!(seen, ["join 1", "join 2", "startup", "join 3", "handover", "leave"]);
    }

    #[test]
    fn lines_of_both_logs_arrive_in_one_poll() {
        let dir = TempDir::new("both");
        dir.write(A, "");
        dir.write(B, "");
        let mut tails = LogTails::new(dir.path());

        dir.append(A, "from a\n");
        dir.append(B, "from b\n");

        let lines = tails.poll(dir.path());
        assert_eq!(lines.len(), 2);
        let from = |name: &str| lines.iter().find(|(p, _)| p.ends_with(name)).map(|(_, l)| l.as_str());
        assert_eq!(from(A), Some("from a"));
        assert_eq!(from(B), Some("from b"));
    }

    #[test]
    fn a_line_cut_in_two_comes_out_whole() {
        let dir = TempDir::new("partial");
        dir.write(A, "");
        let mut tails = LogTails::new(dir.path());

        dir.append(A, "half a li");
        assert_eq!(texts(tails.poll(dir.path())), Vec::<String>::new());
        dir.append(A, "ne\nnext\n");
        assert_eq!(texts(tails.poll(dir.path())), ["half a line", "next"]);
    }

    /// The bug that made the menu miss a join: a log that Roblox still has open reported an old size in the
    /// directory listing, so the new lines were not seen until the log was closed, and then the log was read again
    /// from the top.
    #[test]
    fn a_log_that_is_still_open_for_writing_is_followed_as_it_grows() {
        let dir = TempDir::new("open");
        let log = dir.path().join(A);
        let mut roblox = fs::File::create(&log).unwrap(); // kept open, like the player does
        let mut tails = LogTails::new(dir.path());
        let mut seen = Vec::new();

        for line in ["join", "server", "leave"] {
            roblox.write_all(format!("{line}
").as_bytes()).unwrap();
            roblox.flush().unwrap();
            // give the file system the time it takes to show a stale size, if it were going to
            std::thread::sleep(Duration::from_millis(50));
            seen.extend(texts(tails.poll(dir.path())));
        }

        assert_eq!(seen, ["join", "server", "leave"]);
    }

    #[test]
    fn only_the_newest_logs_are_followed() {
        let dir = TempDir::new("newest");
        for i in 0..(FOLLOWED_LOGS + 4) {
            dir.write(&format!("0.741.0.7411058_2026100{}T000000Z_Player_AAAAA_last.log", i % 10), "x
");
        }
        let logs = player_logs(dir.path());

        assert_eq!(logs.len(), FOLLOWED_LOGS);
        // the oldest are the ones that are left out
        assert!(logs.iter().all(|(p, _)| !p.ends_with("0.741.0.7411058_20261000T000000Z_Player_AAAAA_last.log")));
    }

    #[test]
    fn a_log_that_is_started_over_is_read_again() {
        let dir = TempDir::new("shrink");
        dir.write(A, "a long first part of the log\n");
        let mut tails = LogTails::new(dir.path());

        dir.write(A, "new\n");

        assert_eq!(texts(tails.poll(dir.path())), ["new"]);
    }

    #[test]
    fn crash_handler_and_studio_logs_are_not_read() {
        let dir = TempDir::new("others");
        let mut tails = LogTails::new(dir.path());

        dir.write("0.741.0.7411058_20261005T045032Z_Player_914ED_CrashHandler_last.log", "crash\n");
        dir.write("0.741.0.7411058_20261005T045032Z_Studio_AAAAA_last.log", "studio\n");

        assert_eq!(texts(tails.poll(dir.path())), Vec::<String>::new());
    }

    #[test]
    fn a_deleted_log_is_forgotten_and_a_missing_folder_is_empty() {
        let dir = TempDir::new("deleted");
        dir.write(A, "line\n");
        let mut tails = LogTails::new(dir.path());

        fs::remove_file(dir.path().join(A)).unwrap();
        assert_eq!(texts(tails.poll(dir.path())), Vec::<String>::new());
        assert!(tails.files.is_empty());

        assert_eq!(texts(tails.poll(&dir.path().join("missing"))), Vec::<String>::new());
    }
}
