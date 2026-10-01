use std::collections::HashMap;
use std::fs::{self, File};
use std::io;
use std::path::Path;

use serde::Deserialize;
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

/// a cached package zip and the install folder its entries extract under (e.g. "shaders/")
#[derive(Debug, Clone, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PackageSource {
    pub zip_path: String,
    pub prefix: String,
}

/// extract only the wanted files (paths relative to the install root) out of cached package
/// zips into `dest_dir`, instead of unpacking whole packages. returns the paths found, so
/// the caller can tell stock files apart from ones a mod added.
/// zip entries are CRC-checked while they're read, so a corrupt cached package fails here.
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn extract_package_files(
    sources: Vec<PackageSource>,
    dest_dir: String,
    paths: Vec<String>,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        // windows paths are case-insensitive, so match case-insensitively but write the caller's casing
        let mut wanted: HashMap<String, String> = paths
            .into_iter()
            .map(|p| (p.replace('\\', "/").to_lowercase(), p))
            .collect();
        let dest = Path::new(&dest_dir);
        let mut found = Vec::new();

        for source in sources {
            if wanted.is_empty() {
                break;
            }

            let file = File::open(&source.zip_path)
                .map_err(|e| format!("Cannot open zip '{}': {}", source.zip_path, e))?;
            let mut archive = ZipArchive::new(file)
                .map_err(|e| format!("Cannot read zip '{}': {}", source.zip_path, e))?;

            for i in 0..archive.len() {
                let mut entry = archive
                    .by_index(i)
                    .map_err(|e| format!("Cannot read entry {} of '{}': {}", i, source.zip_path, e))?;
                if entry.is_dir() {
                    continue;
                }

                let key = format!("{}{}", source.prefix, entry.name()).to_lowercase();
                let Some(original) = wanted.remove(&key) else {
                    continue;
                };

                let outpath = dest.join(&original);
                if let Some(parent) = outpath.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Cannot create dir '{}': {}", parent.display(), e))?;
                }
                let mut outfile = File::create(&outpath)
                    .map_err(|e| format!("Cannot create file '{}': {}", outpath.display(), e))?;
                io::copy(&mut entry, &mut outfile)
                    .map_err(|e| format!("Cannot extract '{}': {}", original, e))?;

                found.push(original);
            }
        }

        Ok(found)
    })
    .await
    .map_err(|e| format!("extract_package_files task panicked: {}", e))?
}
