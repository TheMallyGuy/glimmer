<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/state";
  import { SettingGroup, SettingRow, Switch, cn } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { useIntlayer } from "svelte-intlayer";
  const flagsLayoutContent = useIntlayer("flagsLayout");

  let { children }: { children: Snippet } = $props();

  const views = [
    { href: "/flags/editor", label: $flagsLayoutContent.viewEditor.value },
    { href: "/flags/presets", label: $flagsLayoutContent.viewPresets.value },
  ];
</script>

<SettingGroup>
  <SettingRow
    title={$flagsLayoutContent.enableFastFlags.value}
    description={$flagsLayoutContent.enableFastFlagsDescription.value}
  >
    {#snippet control()}
      <Switch
        label={$flagsLayoutContent.applyOnLaunch.value}
        bind:checked={appState.fastflags.enabled}
      />
    {/snippet}
  </SettingRow>
</SettingGroup>

<nav aria-label={$flagsLayoutContent.flagViewsNav.value} class="my-5 flex gap-1">
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
          "absolute inset-x-3 bottom-0 h-0.5 bg-accent transition-transform duration-200 ease-out motion-reduce:transition-none",
          current ? "scale-x-100" : "scale-x-0",
        )}
      ></span>
    </a>
  {/each}
</nav>

<!-- keyed on the view, so moving between views fades the new one in -->
{#key page.url.pathname}
  <div class="animate-fade-in">{@render children()}</div>
{/key}
