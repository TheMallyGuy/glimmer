use tauri_helper::auto_collect_command;

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn exit() {
    std::process::exit(0);
}
