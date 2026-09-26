// import { mkdir } from '@tauri-apps/plugin-fs';
// import { appCacheDir, join } from '@tauri-apps/api/path';
// import { Downloader } from './download';

// const BASE_URLS = [
//     "https://setup-cfly.rbxcdn.com/",
//     "https://setup-aws.rbxcdn.com/",
//     "https://setup-ak.rbxcdn.com/",
//     "https://setup.rbxcdn.com/",
// ];

// /**
//  * Full dry run of the download pipeline: picks a region, resolves the latest
//  * WindowsPlayer version, downloads every package in its manifest, extracts
//  * them and writes AppSettings.xml. Logs each step so you can see where it
//  * breaks. Everything is written under the OS cache dir, so it's safe to
//  * delete afterwards.
//  */
// export async function dryRunDownload() {
//     console.log('[dry run] picking fastest region…');
//     const dl = await Downloader.create(BASE_URLS);
//     console.log('[dry run] using region:', dl.baseUrl);

//     const version = await dl.fetchLatestVersion('WindowsPlayer');
//     console.log('[dry run] latest version:', version);

//     const manifest = await dl.fetchManifest(version);
//     console.log(`[dry run] manifest has ${manifest.packages.length} packages`);

//     const root = await join(await appCacheDir(), 'glimmer-dry-run', version);
//     const packagesDir = await join(root, 'packages');
//     const distDir = await join(root, 'extracted');

//     await mkdir(packagesDir, { recursive: true });
//     await mkdir(distDir, { recursive: true });

//     console.log('[dry run] downloading packages to', packagesDir);
//     let lastLoggedPercent = -1;
//     await dl.downloadPackagesParallel(version, manifest, packagesDir, 4, (done, total, pkg, percent) => {
//         if (percent === lastLoggedPercent) return;
//         lastLoggedPercent = percent;
//         console.log(`[dry run] downloading (${done}/${total}, ${percent}%) ${pkg.fileName}`);
//     });

//     console.log('[dry run] extracting into', distDir);
//     await dl.extractPackages(packagesDir, distDir, 'WindowsPlayer', (done, total, filename) => {
//         const percent = Math.round((done / total) * 100);
//         console.log(`[dry run] extracting (${done}/${total}, ${percent}%) ${filename}`);
//     });

//     console.log('[dry run] writing AppSettings.xml');
//     await dl.writeXml(distDir);

//     console.log('[dry run] done, client staged at', distDir);
// }

// dryRunDownload().catch((err) => console.error('[dry run] failed:', err));
