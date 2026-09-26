use std::fs::{self, File};
use std::io::{self, Read};
use std::path::Path;

use tauri_helper::auto_collect_command;

const CHUNK_SIZE: usize = 64 * 1024;

/// hash raw bytes with md5, returning the lowercase hex digest
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn md5_bytes(data: Vec<u8>) -> String {
    format!("{:x}", md5::compute(&data))
}

/// hash a single file with md5, streaming it in chunks so large files (zips, packages)
/// don't need to be loaded into memory all at once
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn md5_file(path: String) -> Result<String, String> {
    hash_file(Path::new(&path)).map_err(|e| format!("Cannot hash '{}': {}", path, e))
}

/// hash every file under a directory (e.g. a mod folder) with md5, recursively
/// returns pairs of (path relative to `dir`, hex digest), sorted by path
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn md5_dir(dir: String) -> Result<Vec<(String, String)>, String> {
    let root = Path::new(&dir);
    let mut hashes = Vec::new();

    hash_dir_into(root, root, &mut hashes)
        .map_err(|e| format!("Cannot hash directory '{}': {}", dir, e))?;

    hashes.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(hashes)
}

fn hash_file(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut context = md5::Context::new();
    let mut buffer = [0u8; CHUNK_SIZE];

    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        context.consume(&buffer[..read]);
    }

    Ok(format!("{:x}", context.finalize()))
}

fn hash_dir_into(root: &Path, dir: &Path, out: &mut Vec<(String, String)>) -> io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            hash_dir_into(root, &path, out)?;
        } else {
            let digest = hash_file(&path)?;
            let relative = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            out.push((relative, digest));
        }
    }

    Ok(())
}
