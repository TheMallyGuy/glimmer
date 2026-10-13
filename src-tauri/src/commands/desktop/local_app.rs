use std::fs;
use std::path::PathBuf;
extern crate dirs;
#[cfg(target_os = "macos")]
use dirs::home_dir;
use tauri_helper::auto_collect_command;

#[specta::specta]
#[tauri::command]
#[auto_collect_command]
pub async fn get_local_app(vng: Option<bool>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let mut roblox_path: PathBuf =
        dirs::data_local_dir().ok_or("Could not find local data directory")?;

    #[cfg(target_os = "macos")]
    let mut roblox_path: PathBuf = home_dir().ok_or("Could not find local data directory")?;

    roblox_path.push(if vng.unwrap_or(false) {
        "RobloxPCVNG"
    } else {
        "Roblox"
    });
    roblox_path.push("LocalStorage");
    roblox_path.push("appStorage.json");

    fs::read_to_string(&roblox_path).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn write_local_app(content: String, vng: Option<bool>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut roblox_path: PathBuf =
        dirs::data_local_dir().ok_or("Could not find local data directory")?;

    #[cfg(target_os = "macos")]
    let mut roblox_path: PathBuf = home_dir().ok_or("Could not find local data directory")?;

    roblox_path.push(if vng.unwrap_or(false) {
        "RobloxPCVNG"
    } else {
        "Roblox"
    });
    roblox_path.push("LocalStorage");
    roblox_path.push("appStorage.json");

    // log::info!("contents : {}", content);

    fs::write(roblox_path, content).map_err(|e| e.to_string())
}
