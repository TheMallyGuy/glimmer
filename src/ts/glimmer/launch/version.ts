import { join } from "@tauri-apps/api/path";
import { appState } from "$lib/appState.svelte";
import { Downloader } from "$ts/roblox/installation/download";
import { Installation } from "$ts/roblox/installation/installation";
import { DEFAULT_BASE_URLS, installVersion, installName } from "$ts/roblox/installation";
import { PackageCache } from "$ts/roblox/installation/packageCache";
import type { LaunchReport } from "./types";

/**
 * The version to start, installed first when needed. In order: the pinned version, the active one
 * when upgrades are off, the latest one when it's already installed, else the latest one, installed now.
 */
export async function pickVersion(isStudio: boolean, report: LaunchReport) {
  // VNG only distributes the player, so Studio always uses the global CDN
  const distribution = !isStudio && appState.installations.vngDistribution.enabled ? "vng" : "global";
  const binaryType = isStudio ? "WindowsStudio64" : "WindowsPlayer";

  const d = await Downloader.create(DEFAULT_BASE_URLS, distribution);
  const i = await Installation.create(true, isStudio ? "studio" : "player");
  const installed = await i.listInstallations();

  const pinned = i.getPinnedVersion();
  if (pinned) return pinned;

  const active = i.getActiveVersion() ?? installed[0];
  if (active && appState.installations.disableRobloxUpgrade.enabled) return active;

  const latest = await d.fetchLatestVersion(binaryType);
  const name = installName(latest, distribution);
  const upToDate = installed.find((v) => v.version === name);
  if (upToDate) return upToDate;

  await installVersion(
    d,
    i,
    latest,
    appState.installations.parallelDownloader.value,
    (p) => {
      switch (p.status) {
        case "fetchingManifest":
          return report({ step: "fetchingManifest" }, null);
        case "downloading":
          return report({ step: "downloadingClient", done: p.done, total: p.total }, p.percent);
        case "extracting":
          return report({ step: "extractingClient", done: p.done, total: p.total }, p.percent);
        case "finishing":
          return report({ step: "finishingInstallation" }, null);
      }
    },
    binaryType,
    !isStudio, // the player's zips are what mods restore stock files from
  );
  await i.setActiveVersion(name);

  // mods are only applied to the player, and only the active version's zips are needed to restore it
  if (!isStudio) {
    try {
      await (await PackageCache.create()).prune(name);
    } catch (e) {
      console.error("failed to prune old package cache:", e);
    }
  }

  return { path: await join(i.installationPath, name), version: name };
}
