use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

use sysinfo::{ProcessesToUpdate, System};
use tauri_helper::auto_collect_command;
use tauri_plugin_opener::OpenerExt;

fn is_fleasion(name: &str) -> bool {
    name.to_ascii_lowercase().starts_with("fleasion")
}

fn fleasion_processes(sys: &mut System) -> Vec<(u32, Option<PathBuf>)> {
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let mut found: Vec<_> = sys
        .processes()
        .values()
        .filter(|p| is_fleasion(&p.name().to_string_lossy()))
        .map(|p| (p.pid().as_u32(), p.exe().map(Path::to_path_buf)))
        .collect();
    found.sort_by_key(|(pid, _)| *pid); // the first is the one that was started, the rest are what it started
    found
}

fn wait_until_gone(sys: &mut System, limit: Duration) -> bool {
    let end = Instant::now() + limit;
    loop {
        if fleasion_processes(sys).is_empty() {
            return true;
        }
        if Instant::now() >= end {
            return false;
        }
        thread::sleep(Duration::from_millis(200));
    }
}

/// Kills the processes as administrator (root), after the system's prompt. The ids are the ones just found, so nothing
/// else can be matched.
fn kill_with_prompt(pids: &[u32]) -> Result<(), String> {
    #[cfg(windows)]
    let (program, args) = (
        "taskkill",
        pids.iter()
            .flat_map(|pid| ["/PID".to_string(), pid.to_string()])
            .chain(["/F".to_string()])
            .collect::<Vec<_>>(),
    );
    #[cfg(not(windows))]
    let (program, args) = (
        "kill",
        ["-9".to_string()]
            .into_iter()
            .chain(pids.iter().map(u32::to_string))
            .collect::<Vec<_>>(),
    );

    let declined = |why: String| format!("Fleasion could not be closed as administrator ({why})");
    let status = runas::Command::new(program)
        .args(&args)
        .gui(true)
        .show(false)
        .status()
        .map_err(|e| declined(e.to_string()))?;
    if status.success() {
        Ok(())
    } else {
        Err(declined(format!("{status}")))
    }
}

/// The path Fleasion ran from, when it ran and the system let Glimmer see it
fn stop() -> Result<Option<String>, String> {
    let mut sys = System::new();
    let running = fleasion_processes(&mut sys);
    if running.is_empty() {
        return Ok(None);
    }

    log::info!("stopping fleasion");
    let ran_from = running
        .iter()
        .find_map(|(_, exe)| exe.as_ref())
        .map(|exe| exe.to_string_lossy().into_owned());

    for process in sys.processes().values() {
        if is_fleasion(&process.name().to_string_lossy()) {
            let _ = process.kill(); // refused when Fleasion runs with more rights than Glimmer
        }
    }
    if wait_until_gone(&mut sys, Duration::from_secs(2)) {
        return Ok(ran_from);
    }

    log::info!("fleasion runs with more rights than glimmer, asking the system to close it");
    let pids: Vec<u32> = fleasion_processes(&mut sys).iter().map(|(pid, _)| *pid).collect();
    kill_with_prompt(&pids)?;

    if wait_until_gone(&mut sys, Duration::from_secs(10)) {
        Ok(ran_from)
    } else {
        Err("Fleasion did not close".to_string())
    }
}

/// What to open: the path Glimmer was given, or on Windows the Start menu shortcut Fleasion keeps pointed at where it runs from
fn start_target(path: Option<String>) -> Result<PathBuf, String> {
    if let Some(path) = path.filter(|path| !path.is_empty()) {
        let path = PathBuf::from(path);
        let named_fleasion = path
            .file_name()
            .is_some_and(|name| is_fleasion(&name.to_string_lossy()));
        if !path.exists() || !named_fleasion {
            return Err(format!(
                "Fleasion is not at {} any more. Start Fleasion once, then try again",
                path.display()
            ));
        }
        return Ok(path);
    }

    #[cfg(windows)]
    if let Some(appdata) = std::env::var_os("APPDATA") {
        let shortcut = PathBuf::from(appdata).join(r"Microsoft\Windows\Start Menu\Programs\Fleasion.lnk");
        if shortcut.exists() {
            return Ok(shortcut);
        }
    }

    Err("Glimmer does not know where Fleasion is. Start Fleasion once, then try again".to_string())
}

fn start(app: &tauri::AppHandle, path: Option<String>) -> Result<(), String> {
    let target = start_target(path)?;
    log::info!("starting fleasion");

    // a program that needs more rights has to go through the shell to get the system's prompt, which `open` does; on
    // Linux `open` would hand an executable to the file manager instead of running it
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new(&target)
            .spawn()
            .map(drop)
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "linux"))]
    {
        app.opener()
            .open_path(target.to_string_lossy(), None::<&str>)
            .map_err(|e| e.to_string())
    }
}

/// closes Fleasion when it runs, and says where it ran from when that could be seen. Does nothing when it does not run.
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn fleasion_stop() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(stop)
        .await
        .map_err(|e| e.to_string())?
}

/// opens Fleasion from `path` (where `fleasion_stop` saw it run), or from its Start menu shortcut on Windows when there is none
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn fleasion_start(app: tauri::AppHandle, path: Option<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || start(&app, path))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fleasion_is_found_by_its_file_name_whatever_the_version_or_system() {
        assert!(is_fleasion("Fleasion-v2.4.0-Windows.exe"));
        assert!(is_fleasion("Fleasion-v2.4.0-Linux"));
        assert!(is_fleasion("fleasion.exe"));
        assert!(!is_fleasion("glimmer.exe"));
        assert!(!is_fleasion("NotFleasion.exe"));
    }

    #[test]
    fn a_path_that_is_not_fleasion_is_not_opened() {
        let here = std::env::current_exe().unwrap();
        let err = start_target(Some(here.to_string_lossy().into_owned())).unwrap_err();
        assert!(err.contains("not at"));
    }

    #[test]
    fn a_path_that_is_gone_is_not_opened() {
        let err = start_target(Some("/nowhere/Fleasion-v2.4.0".to_string())).unwrap_err();
        assert!(err.contains("not at"));
    }
}
