use std::collections::HashMap;
use std::fs::{self, File};
use std::io;
use std::ops::Range;
use std::path::Path;

use rayon::prelude::*;
use serde::Deserialize;
use tauri_helper::auto_collect_command;
use zip::read::ZipFile;
use zip::ZipArchive;

fn open_archive(zip_path: &str) -> Result<ZipArchive<File>, String> {
    let file =
        File::open(zip_path).map_err(|e| format!("Cannot open zip '{}': {}", zip_path, e))?;
    ZipArchive::new(file).map_err(|e| format!("Cannot read zip '{}': {}", zip_path, e))
}

fn split_ranges(n: usize) -> Vec<Range<usize>> {
    let chunk = n.div_ceil(rayon::current_num_threads()).max(1);
    (0..n)
        .step_by(chunk)
        .map(|s| s..(s + chunk).min(n))
        .collect()
}

#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub async fn extract_zip(zip_path: String, dest: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dest_path = Path::new(&dest);
        fs::create_dir_all(dest_path)
            .map_err(|e| format!("Cannot create dest dir '{}': {}", dest_path.display(), e))?;

        let count = open_archive(&zip_path)?.len();

        split_ranges(count)
            .into_par_iter()
            .try_for_each(|range| -> Result<(), String> {
                // each worker gets its own file handle + archive
                let mut archive = open_archive(&zip_path)?;
                for i in range {
                    let mut entry = archive
                        .by_index(i)
                        .map_err(|e| format!("Cannot read entry {}: {}", i, e))?;
                    extract_entry(&mut entry, dest_path)?;
                }
                Ok(())
            })
    })
    .await
    .map_err(|e| format!("extract_zip task panicked: {}", e))?
}

fn extract_entry(entry: &mut ZipFile<'_, File>, dest_path: &Path) -> Result<(), String> {
    let outpath = dest_path.join(entry.mangled_name());

    if entry.is_dir() {
        fs::create_dir_all(&outpath)
            .map_err(|e| format!("Cannot create dir '{}': {}", outpath.display(), e))?;
        return Ok(());
    }

    // create_dir_all is safe to race across threads
    if let Some(parent) = outpath.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Cannot create dir '{}': {}", parent.display(), e))?;
    }

    let mut outfile = File::create(&outpath)
        .map_err(|e| format!("Cannot create file '{}': {}", outpath.display(), e))?;
    io::copy(entry, &mut outfile)
        .map_err(|e| format!("Cannot write file '{}': {}", outpath.display(), e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Some(mode) = entry.unix_mode() {
            fs::set_permissions(&outpath, fs::Permissions::from_mode(mode))
                .map_err(|e| format!("Cannot set permissions on '{}': {}", outpath.display(), e))?;
        }
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

        // phase 1 (parallel, cheap): scan each zip's central directory for candidate entries.
        // no decompression happens here.
        let candidates: Vec<Vec<(usize, String)>> = sources
            .par_iter()
            .map(|source| -> Result<_, String> {
                let archive = open_archive(&source.zip_path)?;
                let mut hits = Vec::new();
                for i in 0..archive.len() {
                    let Some(name) = archive.name_for_index(i) else {
                        continue;
                    };
                    if name.ends_with('/') {
                        continue;
                    }
                    let key = format!("{}{}", source.prefix, name).to_lowercase();
                    if wanted.contains_key(&key) {
                        hits.push((i, key));
                    }
                }
                Ok(hits)
            })
            .collect::<Result<_, _>>()?;

        // phase 2 (serial, trivial): first source in list order wins, same as the sequential
        // version, so results stay deterministic when several zips contain the same file.
        let mut jobs: Vec<(&str, Vec<(usize, String)>)> = Vec::new();
        for (source, hits) in sources.iter().zip(candidates) {
            let mut assigned = Vec::new();
            for (idx, key) in hits {
                if let Some(original) = wanted.remove(&key) {
                    assigned.push((idx, original));
                }
            }
            if !assigned.is_empty() {
                jobs.push((source.zip_path.as_str(), assigned));
            }
        }

        // split each zip's jobs into per-thread chunks so one big zip still parallelizes
        let threads = rayon::current_num_threads();
        let units: Vec<(&str, &[(usize, String)])> = jobs
            .iter()
            .flat_map(|(zip_path, list)| {
                let per = list.len().div_ceil(threads).max(1);
                list.chunks(per).map(move |c| (*zip_path, c))
            })
            .collect();

        // phase 3 (parallel): extract
        units
            .par_iter()
            .try_for_each(|(zip_path, list)| -> Result<(), String> {
                let mut archive = open_archive(zip_path)?;
                for (idx, original) in list.iter() {
                    let mut entry = archive.by_index(*idx).map_err(|e| {
                        format!("Cannot read entry {} of '{}': {}", idx, zip_path, e)
                    })?;

                    let outpath = dest.join(original);
                    if let Some(parent) = outpath.parent() {
                        fs::create_dir_all(parent).map_err(|e| {
                            format!("Cannot create dir '{}': {}", parent.display(), e)
                        })?;
                    }
                    let mut outfile = File::create(&outpath).map_err(|e| {
                        format!("Cannot create file '{}': {}", outpath.display(), e)
                    })?;
                    io::copy(&mut entry, &mut outfile)
                        .map_err(|e| format!("Cannot extract '{}': {}", original, e))?;
                }
                Ok(())
            })?;

        Ok(jobs
            .into_iter()
            .flat_map(|(_, list)| list.into_iter().map(|(_, original)| original))
            .collect())
    })
    .await
    .map_err(|e| format!("extract_package_files task panicked: {}", e))?
}
