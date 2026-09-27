// for those whos wondering: yes, this is an tauri command that detects if bubblestrap is installed on the system.
// why do we do this? well let's just say the owner doesnt know about web development (or development in general e.g hes saying sending bubblestrap source via Discord) and "fps counter for debugging fast scrolling on mobile".
// for context, fps counter are born for games. the only reason its should exist on an website is either its doing 3D rendering (games, model showcase) not on a landing website. (well some landing website do have 3D models but thats took ages to make & expensive anyway)
use app_finder::{AppCommon, AppFinder};
use tauri_helper::auto_collect_command;

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn is_bubblestrap() -> bool {
    let apps = AppFinder::list();
    for app in apps {
        if app.name.to_lowercase() == "bubblestrap" {
            return true;
        }
    }

    return false;
}
