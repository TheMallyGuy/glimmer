<script lang="ts">
  import { Installation } from "$ts/roblox/installation/installation";
  import { loadAppState } from "$lib/appState.svelte";
  import "./layout.css";
  import { onMount, type Snippet } from "svelte";
  import { commands } from "$ts/bindings";
  import { message } from "@tauri-apps/plugin-dialog";
  import { exit } from "@tauri-apps/api/app";
  import { isTauri } from "@tauri-apps/api/core";
  import { setupIntlayer, useIntlayer } from "svelte-intlayer";
  const rootLayoutContent = useIntlayer("rootLayout");

  let { children }: { children: Snippet } = $props();

  // starts the intlayer editor client (a no-op unless the editor is enabled)
  setupIntlayer("en");

  onMount(async () => {
    if (!isTauri()) return; // e.g. open in the intlayer editor, where there are no Tauri APIs

    await loadAppState();
    const bubble: boolean = await commands.isBubblestrap();

    const i = await Installation.create();

    i.reIndex();

    if (bubble) {
      // see bubble.rs
      await message($rootLayoutContent.uninstallBubblestrap.value);
      exit(1);
    }
  });
</script>

{@render children()}
