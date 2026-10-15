<script lang="ts">
  import { onMount } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { watchRobloxLogs } from "$ts/roblox/logs/watcher";
  import { processLogLine, setWindowPrompt } from "$ts/roblox/logs/process";
  import { initDiscordRpc, clearActivity } from "$ts/roblox/discordRpc";
  import { loadAppState } from "$lib/appState.svelte";
  import { AppTray } from "$ts/glimmer/tray";
  import { DeepLinkHandler } from "$ts/glimmer/deepLinkHandler";
  import { checkForUpdate } from "$ts/glimmer/updater";
  import { checkForOta } from "$ts/glimmer/ota";
  import { useIntlayer } from "svelte-intlayer";
  const trayContent = useIntlayer("tray");
  const windowContent = useIntlayer("windowControl");
  const updaterContent = useIntlayer("updater");

  const w = window as unknown as { __glimmerBgUnlisten?: UnlistenFn[] };

  onMount(async () => {
    if (!isTauri()) return;

    await new AppTray({
      tooltip: $trayContent.tooltip.value,
      openSelector: $trayContent.openSelector.value,
      quit: $trayContent.quit.value,
    }).show();

    setWindowPrompt((game) => ({
      title: $windowContent.promptTitle.value,
      body: $windowContent.promptBody({ game }).value,
      allow: $windowContent.allow.value,
      deny: $windowContent.deny.value,
    }));

    // the page can load more than once (hot reload): drop the listeners of the last load first
    for (const unlisten of w.__glimmerBgUnlisten ?? []) unlisten();
    w.__glimmerBgUnlisten = [];

    // this window is open as long as Glimmer is, so links are caught even with every other window closed
    w.__glimmerBgUnlisten.push(await new DeepLinkHandler().start());

    w.__glimmerBgUnlisten.push(await watchRobloxLogs(processLogLine));

    w.__glimmerBgUnlisten.push(
      await listen("roblox-exited", () => clearActivity()),
    );

    await loadAppState();
    initDiscordRpc();

    // a dev build has no release to update to
    if (!import.meta.env.DEV) {
      // a new installer comes first: it carries the newest frontend too, so the OTA check only runs without one
      void checkForUpdate((version) => ({
        title: $updaterContent.title.value,
        body: $updaterContent.body({ version }).value,
        install: $updaterContent.install.value,
        later: $updaterContent.later.value,
      })).then((installing) => installing || checkForOta());
    }
  });
</script>
