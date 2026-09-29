<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/state";
  import { SettingGroup, SettingRow, Switch, cn } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { _ } from "svelte-i18n";

  let { children }: { children: Snippet } = $props();

  const views = [
    { href: "/flags/editor", label: $_("flagsLayout.viewEditor") },
    { href: "/flags/presets", label: $_("flagsLayout.viewPresets") },
  ];
</script>

<SettingGroup>
  <SettingRow
    title={$_("flagsLayout.enableFastFlags")}
    description={$_("flagsLayout.enableFastFlagsDescription")}
  >
    {#snippet control()}
      <Switch
        label={$_("flagsLayout.applyOnLaunch")}
        bind:checked={appState.fastflags.enabled}
      />
    {/snippet}
  </SettingRow>
</SettingGroup>

<nav aria-label={$_("flagsLayout.flagViewsNav")} class="my-5 flex gap-1">
  {#each views as view (view.href)}
    {@const current = page.url.pathname.startsWith(view.href)}
    <a
      href={view.href}
      aria-current={current ? "page" : undefined}
      class={cn(
        "relative flex h-9 items-center gap-2 px-3 font-display text-[15px] tracking-[0.01em] no-underline transition-colors motion-reduce:transition-none",
        current ? "text-white" : "text-fg-3 hover:text-fg",
      )}
    >
      {view.label}
      <span
        class={cn(
          "absolute inset-x-3 bottom-0 h-0.5",
          current ? "bg-accent" : "bg-transparent",
        )}
      ></span>
    </a>
  {/each}
</nav>

{@render children()}
