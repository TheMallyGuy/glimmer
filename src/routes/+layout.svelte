<script lang="ts">
  import { Installation } from "$ts/roblox/installation/installation";
  import { loadAppState } from "$lib/appState.svelte";
  import "./layout.css";
  import { onMount, type Snippet } from "svelte";
  import { commands } from "$ts/bindings";
  import { message } from "@tauri-apps/plugin-dialog";
  import { exit } from "@tauri-apps/api/app";
  import { isLoading, _ } from "svelte-i18n";
  import { setupI18n } from "$ts/i18n";

  let { children }: { children: Snippet } = $props();

  setupI18n();

  onMount(async () => {
    await loadAppState();
    const bubble: boolean = await commands.isBubblestrap();

    const i = await Installation.create();

    i.reIndex();

    if (bubble) {
      // see bubble.rs
      await message($_("rootLayout.uninstallBubblestrap"));
      exit(1);
    }
  });
</script>

{#if !$isLoading}
  {@render children()}
{/if}
