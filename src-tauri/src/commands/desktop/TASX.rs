// someone said this is useless
// inspired by how TASX work, please check them out! https://github.com/8damon/TASX-Roblox-Optimizer/

use tauri_helper::auto_collect_command;
use windows::Win32::Foundation::{CloseHandle, E_ACCESSDENIED, HANDLE, HWND};
use windows::Win32::System::SystemInformation::{GetSystemInfo, SYSTEM_INFO};
use windows::Win32::System::Threading::{
    OpenProcess, SetPriorityClass, SetProcessAffinityMask, SetProcessWorkingSetSize,
    ABOVE_NORMAL_PRIORITY_CLASS, BELOW_NORMAL_PRIORITY_CLASS, HIGH_PRIORITY_CLASS,
    IDLE_PRIORITY_CLASS, NORMAL_PRIORITY_CLASS, PROCESS_CREATION_FLAGS, PROCESS_SET_INFORMATION,
    PROCESS_SET_QUOTA, REALTIME_PRIORITY_CLASS,
};
use windows_result::Error;

use std::ffi::c_void;
use std::thread;
use std::time::Duration;
use windows::core::w;
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowW, GetForegroundWindow, GetWindowThreadProcessId, IsWindow,
};

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn get_roblox_hwnd() -> Result<String, String> {
    let hwnd = unsafe { FindWindowW(w!("WINDOWSCLIENT"), None) }.map_err(|e| e.to_string())?;
    Ok((hwnd.0 as isize).to_string())
}

/// whether Roblox is the window the player is using right now. False when Roblox is not open.
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn is_roblox_focused() -> bool {
    unsafe { FindWindowW(w!("WINDOWSCLIENT"), None) }.is_ok_and(is_hwnd_focused)
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn tasx(hwnd: String) -> Result<(), String> {
    let hwnd = hwnd.parse::<isize>().map_err(|e| e.to_string())?;
    start_tasx(HWND(hwnd as *mut c_void));
    Ok(())
}

fn start_tasx(hwnd: HWND) {
    let mut pid: u32 = 0;
    let num_cpus = get_cpu_count();
    let full_mask: usize = (1 << num_cpus) - 1;
    let limited_mask: usize = 0b0011; // TODO make this flexable by adding a config to it
    let mut last_focused: bool = false;

    unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut pid));

        if pid == 0 {
            log::error!("failed to get roblox's PID via HWND when larping");
            return;
        }
    }

    // one handle for the whole run: Roblox is opened once, so a refusal is told once instead of on every focus change
    let roblox = match RobloxProcess::open(pid) {
        Ok(roblox) => roblox,
        Err(e) if e.code() == E_ACCESSDENIED => {
            log::error!(
                "optimizer stopped: Windows refused access to roblox (pid {pid}). Roblox runs with more rights than Glimmer, e.g. it was started as administrator by another tool. Start Roblox without administrator rights, or run Glimmer as administrator. {e}"
            );
            return;
        }
        Err(e) => {
            log::error!("optimizer stopped: failed to open roblox process {e}");
            return;
        }
    };

    log::info!("optimizer running, pid={}", pid);

    loop {
        if unsafe { !IsWindow(Some(hwnd)).as_bool() } {
            log::info!("roblox closed, stopping optimizer");
            break;
        }

        let focused = is_hwnd_focused(hwnd);

        if focused != last_focused {
            last_focused = focused;

            if focused {
                log::info!("focused on pid {}", pid);

                let priority = ABOVE_NORMAL_PRIORITY_CLASS; // get_priority(&app_handle).unwrap_or(ABOVE_NORMAL_PRIORITY_CLASS);
                set_affinity(&roblox, full_mask);
                set_priority(&roblox, priority);
            } else {
                log::info!("NOT focused on pid {}", pid);

                set_affinity(&roblox, limited_mask);
                trim_working_set(&roblox);
                set_priority(&roblox, IDLE_PRIORITY_CLASS);
            }
        }

        thread::sleep(Duration::from_millis(500));
    }
}

// helpers and etc

fn is_hwnd_focused(hwnd: HWND) -> bool {
    unsafe {
        let focused: HWND = GetForegroundWindow();
        focused == hwnd
    }
}

// fn get_priority(app: &tauri::AppHandle) -> Option<PROCESS_CREATION_FLAGS> {
//     let store = app.store("config.json").ok()?;
//     let intergrations = store.get("integrations")?;
//     let priority = intergrations.get("priority")?;
//     let priority_str = priority.as_str()?;
//     parse_priority(priority_str)
// }

/// Roblox's process, opened with the two rights the optimizer needs. The handle is closed when this is dropped.
struct RobloxProcess(HANDLE);

impl RobloxProcess {
    fn open(pid: u32) -> Result<Self, Error> {
        unsafe { OpenProcess(PROCESS_SET_INFORMATION | PROCESS_SET_QUOTA, false, pid) }
            .map(Self)
    }
}

impl Drop for RobloxProcess {
    fn drop(&mut self) {
        let _ = unsafe { CloseHandle(self.0) };
    }
}

fn set_priority(roblox: &RobloxProcess, priority: PROCESS_CREATION_FLAGS) {
    if let Err(e) = unsafe { SetPriorityClass(roblox.0, priority) } {
        log::error!("failed to set priority for roblox {e}");
    }
}

fn trim_working_set(roblox: &RobloxProcess) {
    if let Err(e) = unsafe { SetProcessWorkingSetSize(roblox.0, usize::MAX, usize::MAX) } {
        log::error!("failed to trim roblox {e}");
    }
}

fn set_affinity(roblox: &RobloxProcess, mask: usize) {
    if let Err(e) = unsafe { SetProcessAffinityMask(roblox.0, mask) } {
        log::error!("failed to set affinity roblox {e}");
    }
}

fn get_cpu_count() -> usize {
    unsafe {
        let mut info = SYSTEM_INFO::default();
        GetSystemInfo(&mut info);
        info.dwNumberOfProcessors as usize
    }
}

pub fn parse_priority(name: &str) -> Option<PROCESS_CREATION_FLAGS> {
    match name {
        "BELOW_NORMAL_PRIORITY_CLASS" => Some(BELOW_NORMAL_PRIORITY_CLASS),
        "NORMAL_PRIORITY_CLASS" => Some(NORMAL_PRIORITY_CLASS),
        "ABOVE_NORMAL_PRIORITY_CLASS" => Some(ABOVE_NORMAL_PRIORITY_CLASS),
        "HIGH_PRIORITY_CLASS" => Some(HIGH_PRIORITY_CLASS),
        "REALTIME_PRIORITY_CLASS" => Some(REALTIME_PRIORITY_CLASS),
        _ => None,
    }
}
