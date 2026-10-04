// the Roblox window side of Funkstrap's window control (see src/ts/roblox/windowControl.ts for the rules)

use std::ffi::c_void;
use std::path::Path;

use tauri_helper::auto_collect_command;
use windows::core::{HSTRING, PWSTR};
use windows::Win32::Foundation::{CloseHandle, COLORREF, HWND, RECT};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, GetWindowRect, GetWindowThreadProcessId, SetLayeredWindowAttributes,
    SetWindowLongPtrW, SetWindowPos, SetWindowTextW, GWL_EXSTYLE, LWA_ALPHA, LWA_COLORKEY,
    SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOSENDCHANGING, SWP_NOZORDER, WS_EX_LAYERED,
    WS_EX_TRANSPARENT,
};

fn hwnd_of(hwnd: &str) -> Result<HWND, String> {
    let value = hwnd.parse::<isize>().map_err(|e| e.to_string())?;
    Ok(HWND(value as *mut c_void))
}

fn rect_of(hwnd: HWND) -> Result<RECT, String> {
    let mut rect = RECT::default();
    unsafe { GetWindowRect(hwnd, &mut rect) }.map_err(|e| e.to_string())?;
    Ok(rect)
}

/// the window's title bar text
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn window_set_title(hwnd: String, title: String) -> Result<(), String> {
    unsafe { SetWindowTextW(hwnd_of(&hwnd)?, &HSTRING::from(title)) }.map_err(|e| e.to_string())
}

/// where the window is, as `[x, y, width, height]` in screen pixels
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn window_get_rect(hwnd: String) -> Result<Vec<i32>, String> {
    let rect = rect_of(hwnd_of(&hwnd)?)?;
    Ok(vec![
        rect.left,
        rect.top,
        rect.right - rect.left,
        rect.bottom - rect.top,
    ])
}

/// the screen the window is on, as `[x, y, width, height]` in screen pixels
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn window_get_monitor(hwnd: String) -> Result<Vec<i32>, String> {
    let hwnd = hwnd_of(&hwnd)?;
    let mut info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    unsafe {
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        GetMonitorInfoW(monitor, &mut info)
            .ok()
            .map_err(|e| e.to_string())?;
    }
    let r = info.rcMonitor;
    Ok(vec![r.left, r.top, r.right - r.left, r.bottom - r.top])
}

/// moves and resizes the window, in screen pixels
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn window_set_rect(hwnd: String, x: i32, y: i32, width: i32, height: i32) -> Result<(), String> {
    // async, so a Roblox that is busy never holds Glimmer up
    unsafe {
        SetWindowPos(
            hwnd_of(&hwnd)?,
            None,
            x,
            y,
            width,
            height,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS | SWP_NOSENDCHANGING,
        )
    }
    .map_err(|e| e.to_string())
}

/// makes the window see-through, the way Funkstrap does. With `use_alpha` the whole window fades to `alpha`
/// (0 gone, 255 solid) and `key` is not used. Without it the window stays as it is except that every pixel
/// of the colour `key` (a 0x00bbggrr value) is see-through and click-through, and `alpha` is not used.
/// An `alpha` of 255 takes the effect off.
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn window_set_layer(hwnd: String, alpha: u8, key: u32, use_alpha: bool) -> Result<(), String> {
    set_layer(hwnd_of(&hwnd)?, alpha, key, use_alpha)
}

fn set_layer(hwnd: HWND, alpha: u8, key: u32, use_alpha: bool) -> Result<(), String> {
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        if alpha == 255 {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style & !(WS_EX_LAYERED.0 as isize));
            return Ok(());
        }

        let style = (style | WS_EX_LAYERED.0 as isize) & !(WS_EX_TRANSPARENT.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style);
        let flags = if use_alpha { LWA_ALPHA } else { LWA_COLORKEY };
        SetLayeredWindowAttributes(hwnd, COLORREF(key), alpha, flags).map_err(|e| e.to_string())
    }
}

/// the folder of the program that owns the window (a Roblox version folder)
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn window_exe_dir(hwnd: String) -> Result<String, String> {
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(hwnd_of(&hwnd)?, Some(&mut pid)) };
    if pid == 0 {
        return Err("the window has no process".into());
    }

    let mut buffer = [0u16; 1024];
    let mut len = buffer.len() as u32;
    let path = unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
            .map_err(|e| e.to_string())?;
        let result = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(buffer.as_mut_ptr()),
            &mut len,
        );
        let _ = CloseHandle(process);
        result.map_err(|e| e.to_string())?;
        String::from_utf16_lossy(&buffer[..len as usize])
    };

    Path::new(&path)
        .parent()
        .map(|dir| dir.to_string_lossy().into_owned())
        .ok_or_else(|| "the program has no folder".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::core::w;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DestroyWindow, GetLayeredWindowAttributes, GetWindowTextW,
        LAYERED_WINDOW_ATTRIBUTES_FLAGS, WINDOW_EX_STYLE, WS_OVERLAPPEDWINDOW,
    };

    /// a real top level window of this process, to run the commands against
    fn window() -> HWND {
        unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE(0),
                w!("STATIC"),
                w!("before"),
                WS_OVERLAPPEDWINDOW,
                50,
                60,
                300,
                200,
                None,
                None,
                None,
                None,
            )
        }
        .expect("a test window")
    }

    fn layer(hwnd: HWND) -> Option<(u32, u8, u32)> {
        let style = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) };
        if style & WS_EX_LAYERED.0 as isize == 0 {
            return None;
        }
        let (mut key, mut alpha, mut flags) = (COLORREF(0), 0u8, LAYERED_WINDOW_ATTRIBUTES_FLAGS(0));
        unsafe { GetLayeredWindowAttributes(hwnd, Some(&mut key), Some(&mut alpha), Some(&mut flags)) }
            .expect("layer attributes");
        Some((key.0, alpha, flags.0))
    }

    #[test]
    fn colour_key_mode_keys_the_colour_and_leaves_the_window_solid() {
        let hwnd = window();
        set_layer(hwnd, 249, 0x00ff00, false).unwrap();
        // Windows keeps only what the mode uses: the key here, the alpha in the other mode
        assert_eq!(layer(hwnd), Some((0x00ff00, 0, LWA_COLORKEY.0)));
        unsafe { DestroyWindow(hwnd).unwrap() };
    }

    #[test]
    fn alpha_mode_fades_the_window_and_does_not_key_a_colour() {
        let hwnd = window();
        set_layer(hwnd, 128, 0x00ff00, true).unwrap();
        assert_eq!(layer(hwnd), Some((0, 128, LWA_ALPHA.0)));
        unsafe { DestroyWindow(hwnd).unwrap() };
    }

    #[test]
    fn a_solid_alpha_takes_the_effect_off() {
        let hwnd = window();
        set_layer(hwnd, 100, 0, true).unwrap();
        set_layer(hwnd, 255, 0, true).unwrap();
        assert_eq!(layer(hwnd), None);
        unsafe { DestroyWindow(hwnd).unwrap() };
    }

    #[test]
    fn moves_resizes_and_retitles() {
        let hwnd = window();
        let id = (hwnd.0 as isize).to_string();

        window_set_rect(id.clone(), 10, 20, 640, 480).unwrap();
        // the move is asynchronous, so give it a moment
        let mut rect = vec![];
        for _ in 0..50 {
            rect = window_get_rect(id.clone()).unwrap();
            if rect == [10, 20, 640, 480] {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        assert_eq!(rect, [10, 20, 640, 480]);

        window_set_title(id.clone(), "after".into()).unwrap();
        let mut text = [0u16; 16];
        let len = unsafe { GetWindowTextW(hwnd, &mut text) } as usize;
        assert_eq!(String::from_utf16_lossy(&text[..len]), "after");

        let monitor = window_get_monitor(id).unwrap();
        assert!(monitor[2] > 0 && monitor[3] > 0);
        unsafe { DestroyWindow(hwnd).unwrap() };
    }
}
