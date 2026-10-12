<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { Shizuku } from "$ts/glimmer/android/shizuku/shizukuCom";
  import {
    CircleCheck,
    Gamepad2,
    Hand,
    Plug,
    ShieldCheck,
  } from "@lucide/svelte";
  import { Button, GlimmerLogo, cn } from "$lib";
  import {
    ROBLOX_PACKAGE,
    checkAndroidSetup,
    firstUnmetStep,
    isReady,
    requestShizukuAccess,
    type AndroidSetup,
  } from "$ts/glimmer/android/setup";
  import { useIntlayer } from "svelte-intlayer";
  const t = useIntlayer("onboarding");
  const shizuku = new Shizuku();

  const LAST = 4;
  // 0 welcome, 1 start Shizuku, 2 allow Glimmer, 3 find Roblox, 4 done
  let step = $state(0);
  let setup = $state<AndroidSetup | null>(null);
  let checking = $state(false);

  const icons = [Hand, Plug, ShieldCheck, Gamepad2, CircleCheck];
  const Icon = $derived(icons[step]);

  const titles = $derived([
    $t.welcomeTitle.value,
    $t.shizukuTitle.value,
    $t.permissionTitle.value,
    $t.robloxTitle.value,
    $t.doneTitle.value,
  ]);
  const blurbs = $derived([
    $t.welcomeBlurb.value,
    $t.shizukuBlurb.value,
    $t.permissionBlurb.value,
    $t.robloxBlurb.value,
    $t.doneBlurb.value,
  ]);

  const running = $derived(!!setup && setup.shizuku !== "notRunning");
  const allowed = $derived(setup?.shizuku === "ready");

  /** whether the person can move on from this step */
  const met = $derived(
    step === 0 ||
      (step === 1 && running) ||
      (step === 2 && allowed) ||
      (step === 3 && setup?.roblox === true) ||
      step === LAST,
  );

  async function check() {
    if (checking) return;
    checking = true;
    try {
      setup = await checkAndroidSetup(shizuku);
      if (isReady(setup) && step === 0) return void (await goto("/choose"));
      if (step >= 1 && step < LAST && met) step = firstUnmetStep(setup);
    } finally {
      checking = false;
    }
  }

  async function allow() {
    await requestShizukuAccess(shizuku);
    await check();
  }

  function start() {
    step = setup ? firstUnmetStep(setup) : 1;
  }

  onMount(() => {
    void check();
    // the person leaves for Shizuku or Google Play and comes back
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  });
</script>

{#snippet status(label: string, value: string, ok: boolean)}
  <div class="flex items-center justify-between gap-4 bg-row px-[18px] py-4">
    <span class="text-[15px] font-medium">{label}</span>
    <span class={cn("text-[13px]", ok ? "text-accent" : "text-muted")}
      >{value}</span
    >
  </div>
{/snippet}

<div class="flex h-screen w-screen flex-col bg-app text-fg">
  <header class="flex h-14 shrink-0 items-center gap-4 pr-5 pl-5">
    <GlimmerLogo class="-ml-1.5 h-[26px] w-auto" />
    <span class="grow"></span>
    {#if step > 0 && step < LAST}
      <span class="text-xs text-muted"
        >{$t.stepOf({ current: step, total: LAST - 1 }).value}</span
      >
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

  <main
    class="flex min-h-0 grow flex-col justify-center overflow-auto px-5 py-6"
  >
    {#key step}
      <div class="flex animate-fade-up flex-col gap-6">
        <div class="flex flex-col gap-4">
          <div
            class="flex size-14 items-center justify-center rounded-gl bg-row"
          >
            <Icon
              size={28}
              strokeWidth={1.75}
              aria-hidden="true"
              class={step === LAST ? "text-accent" : "text-muted"}
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <h1
              class="m-0 font-display text-[32px] font-normal tracking-[0.01em]"
            >
              {titles[step]}
            </h1>
            <p class="m-0 max-w-[520px] text-sm text-muted">{blurbs[step]}</p>
          </div>
        </div>

        {#if step === 1}
          <ol class="m-0 flex list-none flex-col gap-0.5 p-0">
            {#each [$t.shizukuStep1.value, $t.shizukuStep2.value, $t.shizukuStep3.value] as line, i (i)}
              <li class="flex items-start gap-4 bg-row px-[18px] py-4">
                <span class="font-display text-lg leading-6 text-muted"
                  >{i + 1}</span
                >
                <span class="text-[13px] leading-6 text-fg-2">{line}</span>
              </li>
            {/each}
          </ol>
          <div class="flex flex-col gap-0.5">
            {@render status(
              $t.shizukuStatus.value,
              running ? $t.running.value : $t.notRunning.value,
              running,
            )}
            <Button class="mt-2" onclick={() => shizuku.openShizuku()}>
              {$t.openShizuku.value}
            </Button>
          </div>
        {:else if step === 2}
          <div class="flex flex-col gap-0.5">
            {@render status(
              $t.permissionStatus.value,
              allowed
                ? $t.allowed.value
                : running
                  ? $t.waiting.value
                  : $t.needsShizuku.value,
              allowed,
            )}
            {#if !allowed}
              <Button class="mt-2" disabled={!running} onclick={allow}>
                {$t.allow.value}
              </Button>
            {/if}
          </div>
        {:else if step === 3}
          <div class="flex flex-col gap-0.5">
            {@render status(
              $t.robloxStatus.value,
              setup?.roblox === true
                ? setup.robloxVersion
                  ? `${$t.installed.value} · ${$t.robloxVersion({ version: setup.robloxVersion }).value}`
                  : $t.installed.value
                : setup?.roblox === false
                  ? $t.missing.value
                  : $t.unknown.value,
              setup?.roblox === true,
            )}
            {#if setup?.roblox !== true}
              <Button
                class="mt-2"
                onclick={() =>
                  openUrl(
                    `https://play.google.com/store/apps/details?id=${ROBLOX_PACKAGE[0]}`,
                  )}
              >
                {$t.getRoblox.value}
              </Button>
            {/if}
          </div>
        {/if}
      </div>
    {/key}
  </main>

  <footer class="flex h-16 shrink-0 items-center gap-1 bg-footer px-5">
    {#if step === 0}
      <Button variant="ghost" onclick={() => goto("/choose")}
        >{$t.skip.value}</Button
      >
    {:else if step < LAST}
      <Button variant="ghost" onclick={() => (step -= 1)}
        >{$t.back.value}</Button
      >
    {/if}
    <span class="grow"></span>
    {#if step === 0}
      <Button variant="primary" arrow onclick={start}
        >{$t.getStarted.value}</Button
      >
    {:else if step < LAST}
      <Button variant="ghost" disabled={checking} onclick={check}
        >{$t.checkAgain.value}</Button
      >
      <Button
        variant="primary"
        arrow
        disabled={!met}
        onclick={() => (step += 1)}
      >
        {$t.next.value}
      </Button>
    {:else}
      <Button variant="primary" arrow onclick={() => goto("/choose")}
        >{$t.continue.value}</Button
      >
    {/if}
  </footer>
</div>
