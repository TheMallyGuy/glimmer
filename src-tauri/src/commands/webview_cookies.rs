use tauri::{AppHandle, Manager};
use tauri_helper::auto_collect_command;

/// The value of a cookie in another window's webview, or null when the window or the cookie is
/// not there. This is the one thing the frontend can't do itself: cookies marked HttpOnly (like
/// Roblox's login) are hidden from page scripts and from fetch.
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn webview_cookie(
    app: AppHandle,
    label: String,
    name: String,
) -> Result<Option<String>, String> {
    let Some(window) = app.get_webview_window(&label) else {
        return Ok(None);
    };

    // reading cookies must happen in an async command on Windows, or it deadlocks
    let cookies = window.cookies().map_err(|e| e.to_string())?;
    Ok(cookies
        .into_iter()
        .find(|c| c.name() == name)
        .map(|c| c.value().to_string()))
}
