use std::fs;
use std::io;
use std::path::Path;

use serde::Serialize;
use tauri_helper::auto_collect_command;

use super::hash::hash_file;

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct AppliedFile {
    /// path of the applied file, relative to the mod's (and the install's) root
    pub path: String,
    /// md5 hash of the applied file, so a future apply can detect drift
    pub hash: String,
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn apply_mod(
    mod_dir: String,
    dest_dir: String,
) -> Result<Vec<AppliedFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let src = Path::new(&mod_dir);
        let dest = Path::new(&dest_dir);

        if !src.is_dir() {
            return Ok(Vec::new());
        }

        let mut applied = Vec::new();
        copy_tree(src, src, dest, &mut applied).map_err(|e| {
            format!(
                "Failed to apply mod from '{}' to '{}': {}",
                mod_dir, dest_dir, e
            )
        })?;

        Ok(applied)
    })
    .await
    .map_err(|e| format!("apply_mod task panicked: {}", e))?
}

fn copy_tree(
    src_root: &Path,
    src: &Path,
    dest: &Path,
    out: &mut Vec<AppliedFile>,
) -> io::Result<()> {
    fs::create_dir_all(dest)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dest.join(entry.file_name());

        if from.is_dir() {
            copy_tree(src_root, &from, &to, out)?;
            continue;
        }

        let relative = from
            .strip_prefix(src_root)
            .unwrap_or(&from)
            .to_string_lossy()
            .replace('\\', "/");

        fs::copy(&from, &to)?;
        let hash = hash_file(&to)?;

        out.push(AppliedFile {
            path: relative,
            hash,
        });
    }

    Ok(())
}
