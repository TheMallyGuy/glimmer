<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { GlimmerLogo, cn } from "$lib";
  import { useIntlayer } from "svelte-intlayer";
  import { LAST, check, stepOf } from "./onboarding.svelte";

  let { children } = $props();
  const t = useIntlayer("onboarding");
  const step = $derived(stepOf(page.url.pathname));

  onMount(() => {
    void check(step);
    // the person leaves for Shizuku or Google Play and comes back
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(step);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  });
</script>

<div class="flex h-screen w-screen flex-col bg-app text-fg">
  <header class="flex h-14 shrink-0 items-center gap-4 pr-5 pl-5">
    <GlimmerLogo markOnly class="-ml-1.5 h-[26px] w-auto" />
    <span class="grow"></span>
    {#if step > 0 && step < LAST}
      <span class="text-xs text-muted">{$t.stepOf({ current: step, total: LAST - 1 }).value}</span>
    {/if}
  </header>

  <!-- one bar per step, filled up to the current one -->
  <ol class="m-0 flex shrink-0 list-none gap-0.5 p-0 px-5" aria-hidden="true">
    {#each [1, 2, 3, 4] as n (n)}
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
