use sysinfo::{ProcessesToUpdate, System};
use tauri_helper::auto_collect_command;
use winreg::enums::*;
use winreg::RegKey;

const FLAG: &str = "~ DISABLEDXMAXIMIZEDWINDOWEDMODE";

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn close_crash_handler() -> Result<(), String> {
    log::info!("close crash handler called");
    let mut sys = System::new_all();

    sys.refresh_processes(ProcessesToUpdate::All, true);

    for process in sys.processes_by_name("RobloxCrashHandler".as_ref()) {
        let pid = process.pid();

        log::info!("found Roblox's crash handler PID: {}, killing it ", pid);

        let _ = process.kill();
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn set_fullscreen_prop(disable: bool, rblx_exe: &str) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    let layers_path = r"Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers";

    let key = hkcu
        .open_subkey_with_flags(layers_path, KEY_READ | KEY_WRITE)
        .map_err(|e| e.to_string())?;

    if disable {
        let current: String = key.get_value(rblx_exe).unwrap_or_default();

        if !current.contains(FLAG) {
            let updated = if current.is_empty() {
                FLAG.to_string()
            } else {
                format!("{} {}", current, FLAG)
            };
            key.set_value(rblx_exe, &updated)
                .map_err(|e| e.to_string())?;
        }
    } else {
        let current: String = key.get_value(rblx_exe).unwrap_or_default();
        let updated = current.replace(FLAG, "").trim().to_string();

        if updated.is_empty() {
            let _ = key.delete_value(rblx_exe);
        } else {
            key.set_value(rblx_exe, &updated)
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn read_fullscreen_prop(rblx_exe: &str) -> Result<bool, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    let layers_path = r"Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers";

    let key = match hkcu.open_subkey(layers_path) {
        Ok(k) => k,
        Err(_) => return Ok(false),
    };

    let current: String = key.get_value(rblx_exe).unwrap_or_default();

    Ok(current.contains(FLAG))
}
