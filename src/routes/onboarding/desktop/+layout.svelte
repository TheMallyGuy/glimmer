<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { X } from "@lucide/svelte";
  import { GlimmerLogo, IconButton, cn } from "$lib";
  import { sizeWindow, closeWindow } from "$lib/window";
  import { useIntlayer } from "svelte-intlayer";
  import { STEPS, stepOf } from "./tour";

  let { children } = $props();
  const common = useIntlayer("common");
  const step = $derived(stepOf(page.url.pathname));

  onMount(() => {
    sizeWindow(620, 460);
  });
</script>

<div class="flex h-screen w-screen flex-col bg-app text-fg">
  <header data-tauri-drag-region class="flex h-14 shrink-0 items-center gap-4 pr-2 pl-5">
    <GlimmerLogo markOnly class="-ml-1.5 h-[26px] w-auto" />
    <span data-tauri-drag-region class="h-full grow"></span>
    <IconButton label={$common.close.value} variant="ghost" onclick={() => closeWindow()}>
      <X size={14} strokeWidth={1.5} />
    </IconButton>
  </header>

  <!-- one bar per step, filled up to the current one -->
  <ol class="m-0 flex shrink-0 list-none gap-0.5 p-0 px-5" aria-hidden="true">
    {#each STEPS as _, n (n)}
      <li
        class={cn(
          "h-0.5 grow transition-colors duration-300 motion-reduce:transition-none",
          n <= step ? "bg-accent" : "bg-track",
        )}
      ></li>
    {/each}
  </ol>

  {@render children()}
</div>
