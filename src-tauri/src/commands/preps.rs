use sysinfo::{ProcessesToUpdate, System};
use tauri_helper::auto_collect_command;

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
