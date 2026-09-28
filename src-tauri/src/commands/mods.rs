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
    backup_dir: String,
) -> Result<Vec<AppliedFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let src = Path::new(&mod_dir);
        let dest = Path::new(&dest_dir);
        let backup = Path::new(&backup_dir);

        if !src.is_dir() {
            return Ok(Vec::new());
        }

        let mut applied = Vec::new();
        copy_tree(src, src, dest, backup, &mut applied).map_err(|e| {
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

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn revert_files(
    dest_dir: String,
    backup_dir: String,
    paths: Vec<String>,
) -> Result<u32, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dest = Path::new(&dest_dir);
        let backup = Path::new(&backup_dir);
        let mut reverted: u32 = 0;

        for relative in paths {
            let backup_path = backup.join(&relative);
            if !backup_path.is_file() {
                continue;
            }

            let dest_path = dest.join(&relative);
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }

            fs::copy(&backup_path, &dest_path)
                .map_err(|e| format!("Failed to revert '{}': {}", relative, e))?;
            reverted += 1;
        }

        Ok(reverted)
    })
    .await
    .map_err(|e| format!("revert_files task panicked: {}", e))?
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn backup_install(dest_dir: String, backup_dir: String) -> Result<u32, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dest = Path::new(&dest_dir);
        let backup = Path::new(&backup_dir);

        if !dest.is_dir() {
            return Ok(0);
        }

        let mut backed_up = 0u32;
        snapshot_tree(dest, backup, &mut backed_up).map_err(|e| {
            format!(
                "Failed to back up '{}' to '{}': {}",
                dest_dir, backup_dir, e
            )
        })?;

        Ok(backed_up)
    })
    .await
    .map_err(|e| format!("backup_install task panicked: {}", e))?
}

fn snapshot_tree(src: &Path, backup: &Path, count: &mut u32) -> io::Result<()> {
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();

        if from.is_dir() {
            let sub = backup.join(entry.file_name());
            snapshot_tree(&from, &sub, count)?;
            continue;
        }

        let backup_path = backup.join(entry.file_name());
        if backup_path.is_file() {
            continue; // never clobber an existing backup with the current (possibly-modded) file
        }

        if let Some(parent) = backup_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(&from, &backup_path)?;
        *count += 1;
    }

    Ok(())
}

fn copy_tree(
    src_root: &Path,
    src: &Path,
    dest: &Path,
    backup_root: &Path,
    out: &mut Vec<AppliedFile>,
) -> io::Result<()> {
    fs::create_dir_all(dest)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dest.join(entry.file_name());

        if from.is_dir() {
            copy_tree(src_root, &from, &to, backup_root, out)?;
            continue;
        }

        let relative = from
            .strip_prefix(src_root)
            .unwrap_or(&from)
            .to_string_lossy()
            .replace('\\', "/");

        let backup_path = backup_root.join(&relative);
        if to.is_file() && !backup_path.is_file() {
            if let Some(parent) = backup_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&to, &backup_path)?;
        }

        fs::copy(&from, &to)?;
        let hash = hash_file(&to)?;

        out.push(AppliedFile {
            path: relative,
            hash,
        });
    }

    Ok(())
}
