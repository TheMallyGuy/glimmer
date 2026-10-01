use std::process::{Command, Stdio};

use tauri_helper::auto_collect_command;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// run the bundled BuildersColors sidecar (see `externalBin` in tauri.conf.json) and return what
/// it printed. tauri puts the sidecar next to the app executable, without the target triple.
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn run_font_tool(args: Vec<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let exe = std::env::current_exe()
            .map_err(|e| format!("Could not find the app folder: {e}"))?
            .with_file_name(if cfg!(windows) {
                "BuildersColors.exe"
            } else {
                "BuildersColors"
            });

        if !exe.is_file() {
            return Err(format!("Font tool not found: '{}'", exe.display()));
        }

        let mut cmd = Command::new(&exe);
        cmd.args(&args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let out = cmd
            .output()
            .map_err(|e| format!("Failed to run the font tool: {e}"))?;

        let mut text = String::from_utf8_lossy(&out.stdout).into_owned();
        let err = String::from_utf8_lossy(&out.stderr);
        if !out.status.success() {
            return Err(format!("{}{}", text, err).trim().to_string());
        }
        text.push_str(&err);
        Ok(text.trim().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
