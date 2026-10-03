<script lang="ts">
  import { onMount } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { watchRobloxLogs } from "$ts/roblox/logs/watcher";
  import { processLogLine } from "$ts/roblox/logs/process";
  import { initDiscordRpc, clearActivity } from "$ts/roblox/discordRpc";
  import { loadAppState } from "$lib/appState.svelte";
  import { AppTray } from "$ts/tray";
  import { useIntlayer } from "svelte-intlayer";
  const trayContent = useIntlayer("tray");

  const w = window as unknown as { __glimmerBgUnlisten?: UnlistenFn[] };

  onMount(async () => {
    if (!isTauri()) return;

    await new AppTray({
      tooltip: $trayContent.tooltip.value,
      openSelector: $trayContent.openSelector.value,
      quit: $trayContent.quit.value,
    }).show();

    for (const unlisten of w.__glimmerBgUnlisten ?? []) unlisten();
    w.__glimmerBgUnlisten = [];

    w.__glimmerBgUnlisten.push(await watchRobloxLogs(processLogLine));

    w.__glimmerBgUnlisten.push(
      await listen("roblox-exited", () => clearActivity()),
    );

    await loadAppState();
    initDiscordRpc();
  });
</script>
