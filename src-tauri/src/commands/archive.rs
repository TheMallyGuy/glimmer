use std::fs::{self, File};
use std::io;
use std::path::Path;

use tauri_helper::auto_collect_command;
use zip::read::ZipFile;
use zip::ZipArchive;

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn extract_zip(zip_path: String, dest: String) -> Result<(), String> {
    let file =
        File::open(&zip_path).map_err(|e| format!("Cannot open zip '{}': {}", zip_path, e))?;

    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Cannot read zip archive: {}", e))?;

    let dest_path = Path::new(&dest);

    fs::create_dir_all(dest_path)
        .map_err(|e| format!("Cannot create dest dir '{}': {}", dest_path.display(), e))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Cannot read entry {}: {}", i, e))?;

        #[cfg(unix)]
        let unix_mode = entry.unix_mode();
        #[cfg(unix)]
        let outpath = dest_path.join(entry.mangled_name());

        extract_entry(&mut entry, dest_path)?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if !entry.is_dir() {
                if let Some(mode) = unix_mode {
                    fs::set_permissions(&outpath, fs::Permissions::from_mode(mode)).map_err(
                        |e| format!("Cannot set permissions on '{}': {}", outpath.display(), e),
                    )?;
                }
            }
        }
    }

    Ok(())
}

fn extract_entry(entry: &mut ZipFile<'_, File>, dest_path: &Path) -> Result<(), String> {
    let outpath = dest_path.join(entry.mangled_name());

    if entry.is_dir() {
        fs::create_dir_all(&outpath)
            .map_err(|e| format!("Cannot create dir '{}': {}", outpath.display(), e))?;
    } else {
        if let Some(parent) = outpath.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Cannot create dir '{}': {}", parent.display(), e))?;
        }

        let mut outfile = File::create(&outpath)
            .map_err(|e| format!("Cannot create file '{}': {}", outpath.display(), e))?;

        io::copy(entry, &mut outfile)
            .map_err(|e| format!("Cannot write file '{}': {}", outpath.display(), e))?;
    }

    Ok(())
}
