use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;

use tauri::{AppHandle, Emitter};
use tauri_helper::auto_collect_command;

#[cfg(target_os = "windows")]
const DETACHED_PROCESS: u32 = 0x00000008;

/// spawn an installed Roblox executable and detach, so it keeps running after Glimmer closes.
/// also watches the spawned process in the background and emits "roblox-exited"
/// once it closes, so the frontend can clear Discord RPC's presence.
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn launch(app: AppHandle, exe_path: String, args: Vec<String>) -> Result<(), String> {
    let path = Path::new(&exe_path);

    if !path.is_file() {
        return Err(format!("Executable not found: '{}'", exe_path));
    }

    let mut cmd = Command::new(path);
    cmd.args(&args)
        .current_dir(path.parent().unwrap_or(Path::new(".")))
        // don't inherit our stdio: if ours is a piped/captured handle (e.g. running
        // under `tauri dev`), Roblox writing to it with nobody reading blocks once
        // the pipe buffer fills, which stalls the client until it self-reports as
        // timed out. a bare double-click gets fresh handles and never hits this.
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(DETACHED_PROCESS);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to launch '{}': {}", exe_path, e))?;

    thread::spawn(move || {
        let _ = child.wait();
        let _ = app.emit("roblox-exited", ());
    });

    Ok(())
}
