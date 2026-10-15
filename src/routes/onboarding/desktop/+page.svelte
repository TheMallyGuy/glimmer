<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { Hand, Languages, CircleCheck, X } from "@lucide/svelte";
  import {
    Button,
    Dropdown,
    GlimmerLogo,
    IconButton,
    SettingRow,
    cn,
  } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { save } from "$lib/settings.svelte";
  import { sizeWindow, closeWindow } from "$lib/window";
  import { useIntlayer } from "svelte-intlayer";
  const t = useIntlayer("tour");
  const common = useIntlayer("common");

  const LAST = 2;
  // 0 welcome, 1 language, 2 done
  let step = $state(0);
  let language = $state("en");

  const icons = [Hand, Languages, CircleCheck];
  const Icon = $derived(icons[step]);

  const titles = $derived([
    $t.welcomeTitle.value,
    $t.languageTitle.value,
    $t.doneTitle.value,
  ]);
  const blurbs = $derived([
    $t.welcomeBlurb.value,
    $t.languageBlurb.value,
    $t.doneBlurb.value,
  ]);

  onMount(() => {
    sizeWindow(620, 460);
  });

  /** the tour is seen either way: it only shows on the first launch */
  async function leave() {
    appState.onboarded = true;
    await save();
    await goto("/choose");
  }
</script>

<div class="flex h-screen w-screen flex-col bg-app text-fg">
  <header
    data-tauri-drag-region
    class="flex h-14 shrink-0 items-center gap-4 pr-2 pl-5"
  >
    <GlimmerLogo markOnly class="-ml-1.5 h-[26px] w-auto" />
    <span data-tauri-drag-region class="h-full grow"></span>
    <IconButton
      label={$common.close.value}
      variant="ghost"
      onclick={() => closeWindow()}
    >
      <X size={14} strokeWidth={1.5} />
    </IconButton>
  </header>

  <!-- one bar per step, filled up to the current one -->
  <ol class="m-0 flex shrink-0 list-none gap-0.5 p-0 px-5" aria-hidden="true">
    {#each [0, 1, 2] as n (n)}
      <li
        class={cn(
          "h-0.5 grow transition-colors duration-300 motion-reduce:transition-none",
          n <= step ? "bg-accent" : "bg-track",
        )}
      ></li>
    {/each}
  </ol>

  <main class="flex min-h-0 grow flex-col justify-center overflow-auto px-8 py-6">
    {#key step}
      <div class="flex animate-fade-up flex-col gap-6">
        <div class="flex flex-col gap-4">
          <div class="flex size-14 items-center justify-center rounded-gl bg-row">
            <Icon
              size={28}
              strokeWidth={1.75}
              aria-hidden="true"
              class={step === LAST ? "text-accent" : "text-muted"}
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <h1 class="m-0 font-display text-[32px] font-normal tracking-[0.01em]">
              {titles[step]}
            </h1>
            <p class="m-0 max-w-[520px] text-sm text-muted">{blurbs[step]}</p>
          </div>
        </div>

        {#if step === 1}
          <div class="flex flex-col gap-0.5">
            <SettingRow title={$t.languageLabel.value}>
              {#snippet control()}
                <Dropdown
                  label={$t.languageLabel.value}
                  width="200px"
                  options={[{ value: "en", label: $t.english.value }]}
                  bind:value={language}
                />
              {/snippet}
            </SettingRow>
          </div>
        {/if}
      </div>
    {/key}
  </main>

  <footer class="flex h-16 shrink-0 items-center gap-1 bg-footer px-5">
    {#if step === 0}
      <Button variant="ghost" onclick={leave}>{$t.skip.value}</Button>
    {:else if step < LAST}
      <Button variant="ghost" onclick={() => (step -= 1)}>{$t.back.value}</Button>
    {/if}
    <span class="grow"></span>
    {#if step === 0}
      <Button variant="primary" arrow onclick={() => (step = 1)}>{$t.getStarted.value}</Button>
    {:else if step < LAST}
      <Button variant="primary" arrow onclick={() => (step += 1)}>{$t.next.value}</Button>
    {:else}
      <Button variant="primary" arrow onclick={leave}>{$t.finish.value}</Button>
    {/if}
  </footer>
</div>
