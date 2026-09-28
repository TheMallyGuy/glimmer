<script lang="ts">
  import { onMount } from "svelte";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { watchRobloxLogs } from "$ts/roblox/logs/watcher";
  import { processLogLine } from "$ts/roblox/logs/process";
  import { initDiscordRpc, clearActivity } from "$ts/roblox/discordRpc";
  import { loadAppState } from "$lib/appState.svelte";

  const w = window as unknown as { __glimmerBgUnlisten?: UnlistenFn[] };

  onMount(async () => {
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
