use std::path::Path;
use std::process::Command;

use tauri_helper::auto_collect_command;

/// spawn an installed Roblox executable and detach, so it keeps running after Glimmer closes
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn launch(exe_path: String, args: Vec<String>) -> Result<(), String> {
    let path = Path::new(&exe_path);

    if !path.is_file() {
        return Err(format!("Executable not found: '{}'", exe_path));
    }

    Command::new(path)
        .args(&args)
        .current_dir(path.parent().unwrap_or(Path::new(".")))
        .spawn()
        .map_err(|e| format!("Failed to launch '{}': {}", exe_path, e))?;

    Ok(())
}
