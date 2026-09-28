<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/state";
  import { SettingGroup, SettingRow, Switch, cn } from "$lib";
  import { appState } from "$lib/appState.svelte";

  let { children }: { children: Snippet } = $props();

  const views = [
    { href: "/flags/editor", label: "Editor" },
    { href: "/flags/presets", label: "Presets" },
  ];
</script>

<SettingGroup>
  <SettingRow
    title="Apply Fast Flags on launch"
    description="Write these flags to the active install's ClientAppSettings.json before Roblox starts."
  >
    {#snippet control()}
      <Switch
        label="Apply Fast Flags on launch"
        bind:checked={appState.fastflags.enabled}
      />
    {/snippet}
  </SettingRow>
</SettingGroup>

<nav aria-label="Fast Flag views" class="my-5 flex gap-1">
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
