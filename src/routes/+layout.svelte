<script lang="ts">
  import { Installation } from "$ts/roblox/installation/installation";
  import { appState, loadAppState } from "$lib/appState.svelte";
  import { AccentTheme } from "$ts/theme";
  import { applyBackground } from "$lib/appearance.svelte";
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

  // the settings window previews a new accent as it is picked; other windows get the saved one when they load
  $effect(() => AccentTheme.apply(appState.appearance.accent));
  $effect(() => {
    const { color, image, dim } = appState.appearance.background;
    applyBackground(color, image, dim);
  });

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
