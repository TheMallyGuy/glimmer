<script lang="ts">
  import { Installation } from "$ts/roblox/installation/installation";
  import { loadAppState } from "$lib/appState.svelte";
  import "./layout.css";
  import { onMount, type Snippet } from "svelte";
  import { commands } from "$ts/bindings";
  import { message } from "@tauri-apps/plugin-dialog";
  import { exit } from "@tauri-apps/api/app";

  let { children }: { children: Snippet } = $props();

  onMount(async () => {
    await loadAppState();
    const bubble: boolean = await commands.isBubblestrap();

    const i = await Installation.create();

    i.reIndex();

    if (bubble) {
      // see bubble.rs
      await message("Please uninstall Bubblestrap to launch glimmer.");
      exit(1);
    }
  });
</script>

{@render children()}
