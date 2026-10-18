<script lang="ts">
  import { Check } from "@lucide/svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import {
    Button,
    Dropdown,
    LanguageDropdown,
    SettingGroup,
    SettingRow,
    TextField,
    cn,
  } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { ACCENT_PRESETS, AccentTheme, DEFAULT_ACCENT } from "$ts/glimmer/theme";
  import {
    BACKGROUND_PRESETS,
    BackgroundImage,
    BackgroundTheme,
    IMAGE_EXTENSIONS,
    MAX_DIM,
  } from "$ts/glimmer/background";
  import { CustomSplash, SPLASH_THEMES, type SplashTheme } from "$ts/glimmer/customSplash";
  import { isAndroid } from "$ts/glimmer/android/platform";
  import { openSplashPreview } from "$ts/windows/splash";
  import { useIntlayer } from "svelte-intlayer";
  const appearanceContent = useIntlayer("appearance");
  const commonContent = useIntlayer("common");

  const appearance = appState.appearance;

  //  accent colour
  let custom = $state(appearance.accent);
  const parsed = $derived(AccentTheme.normalize(custom));
  const accentError = $derived(
    parsed === null
      ? $appearanceContent.invalidColor.value
      : !AccentTheme.isReadable(parsed)
        ? $appearanceContent.tooDark.value
        : "",
  );

  $effect(() => {
    if (parsed && !accentError) appearance.accent = parsed;
  });

  function pickAccent(color: string) {
    appearance.accent = color;
    custom = color;
  }

  //  background colour
  let customBackground = $state(appearance.background.color);
  const parsedBackground = $derived(AccentTheme.normalize(customBackground));
  const backgroundError = $derived(
    parsedBackground === null
      ? $appearanceContent.invalidColor.value
      : !BackgroundTheme.isUsable(parsedBackground)
        ? $appearanceContent.backgroundTooLight.value
        : "",
  );

  $effect(() => {
    if (parsedBackground && !backgroundError) appearance.background.color = parsedBackground;
  });

  function pickBackground(color: string) {
    appearance.background.color = color;
    customBackground = color;
  }

  //  background picture
  const images = new BackgroundImage();
  let imageError = $state("");

  async function chooseImage() {
    imageError = "";
    const picked = await open({
      title: $appearanceContent.imagePickerTitle.value,
      multiple: false,
      filters: [
        {
          name: $appearanceContent.imageFilter.value,
          extensions: IMAGE_EXTENSIONS,
        },
      ],
    });
    if (typeof picked !== "string") return;

    try {
      appearance.background.image = await images.save(picked);
    } catch (e) {
      imageError = $appearanceContent.imageFailed({
        error: e instanceof Error ? e.message : String(e),
      }).value;
    }
  }

  //  custom splash
  const splashes = new CustomSplash();
  let splashError = $state("");

  /** the dropdown entry for a saved `appearance.splash`: built-in, a bundled theme, or the person's file */
  const splashChoiceOf = (splash: string) =>
    !splash ? "builtin" : (SPLASH_THEMES.find((theme) => splash === `${theme}.html`) ?? "custom");
  let splashChoice = $state(splashChoiceOf(appearance.splash));

  async function pickSplash(choice: string) {
    splashError = "";
    try {
      if (choice === "builtin") {
        appearance.splash = "";
        await splashes.remove();
      } else if (choice === "custom") {
        const picked = await open({
          title: $appearanceContent.splashPickerTitle.value,
          multiple: false,
          filters: [{ name: "HTML", extensions: ["html", "htm"] }],
        });
        if (typeof picked !== "string") {
          splashChoice = splashChoiceOf(appearance.splash);
          return;
        }
        await splashes.save(picked);
        appearance.splash = picked.split(/[\\/]/).pop() ?? picked;
      } else {
        await splashes.saveTheme(choice as SplashTheme);
        appearance.splash = `${choice}.html`;
      }
    } catch (e) {
      splashChoice = splashChoiceOf(appearance.splash);
      splashError = $appearanceContent.splashFailed({
        error: e instanceof Error ? e.message : String(e),
      }).value;
    }
  }

  async function removeImage() {
    const name = appearance.background.image;
    appearance.background.image = "";
    imageError = "";
    if (name) await images.remove(name);
  }
</script>

{#snippet swatches(
  colors: readonly string[],
  current: string,
  label: string,
  swatchLabel: (color: string) => string,
  pick: (color: string) => void,
)}
  <div role="radiogroup" aria-label={label} class="flex gap-0.5">
    {#each colors as color (color)}
      {@const checked = current === color}
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        aria-label={swatchLabel(color)}
        class={cn(
          "flex size-9 cursor-pointer items-center justify-center rounded-gl border-0 p-0 transition-opacity motion-reduce:transition-none",
          checked ? "opacity-100" : "opacity-60 hover:opacity-100",
        )}
        style:background-color={color}
        style:color={AccentTheme.shades(color).onAccent}
        onclick={() => pick(color)}
      >
        {#if checked}
          <Check size={16} strokeWidth={1.75} aria-hidden="true" />
        {/if}
      </button>
    {/each}
  </div>
{/snippet}

<div class="flex flex-col gap-7">
  <SettingGroup>
    <SettingRow title={$commonContent.language.value}>
      {#snippet control()}
        <LanguageDropdown />
      {/snippet}
    </SettingRow>
  </SettingGroup>

  {#if !isAndroid()}
    <SettingGroup label={$appearanceContent.splashGroup.value}>
      <SettingRow
        title={$appearanceContent.splashTitle.value}
        description={splashChoice === "custom"
          ? appearance.splash
          : $appearanceContent.splashDescription.value}
        note={splashError}
      >
        {#snippet control()}
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onclick={() => openSplashPreview(splashChoice !== "builtin")}
            >
              {$appearanceContent.splashPreview.value}
            </Button>
            <Dropdown
              size="sm"
              width="180px"
              label={$appearanceContent.splashTitle.value}
              bind:value={splashChoice}
              options={[
                { value: "builtin", label: $appearanceContent.splashBuiltIn.value },
                { value: "blush", label: $appearanceContent.splashThemeBlush.value },
                { value: "ember", label: $appearanceContent.splashThemeEmber.value },
                { value: "crimson", label: $appearanceContent.splashThemeCrimson.value },
                { value: "custom", label: $appearanceContent.splashCustom.value },
              ]}
              onchange={pickSplash}
            />
          </div>
        {/snippet}
      </SettingRow>
    </SettingGroup>
  {/if}

  <SettingGroup label={$appearanceContent.accentGroup.value}>
    <SettingRow
      title={$appearanceContent.accentTitle.value}
      description={$appearanceContent.accentDescription.value}
    >
      {#snippet control()}
        {@render swatches(
          ACCENT_PRESETS,
          appearance.accent,
          $appearanceContent.accentTitle.value,
          (color) => $appearanceContent.swatchLabel({ color }).value,
          pickAccent,
        )}
      {/snippet}
    </SettingRow>

    <div class="flex items-end gap-3 bg-row px-[18px] py-4">
      <TextField
        class="w-60"
        label={$appearanceContent.customColor.value}
        hint={$appearanceContent.customHint.value}
        error={accentError}
        spellcheck={false}
        autocomplete="off"
        bind:value={custom}
      />
      <Button
        variant="secondary"
        size="sm"
        disabled={appearance.accent === DEFAULT_ACCENT}
        onclick={() => pickAccent(DEFAULT_ACCENT)}
      >
        {$appearanceContent.reset.value}
      </Button>
    </div>
  </SettingGroup>

  <SettingGroup label={$appearanceContent.backgroundGroup.value}>
    <SettingRow
      title={$appearanceContent.backgroundColorTitle.value}
      description={$appearanceContent.backgroundColorDescription.value}
    >
      {#snippet control()}
        {@render swatches(
          BACKGROUND_PRESETS,
          appearance.background.color,
          $appearanceContent.backgroundColorTitle.value,
          (color) => $appearanceContent.backgroundSwatchLabel({ color }).value,
          pickBackground,
        )}
      {/snippet}
    </SettingRow>

    <div class="flex items-end gap-3 bg-row px-[18px] py-4">
      <TextField
        class="w-60"
        label={$appearanceContent.backgroundCustomColor.value}
        hint={$appearanceContent.customHint.value}
        error={backgroundError}
        spellcheck={false}
        autocomplete="off"
        bind:value={customBackground}
      />
    </div>

    <SettingRow
      title={$appearanceContent.imageTitle.value}
      description={appearance.background.image
        ? appearance.background.image
        : $appearanceContent.imageDescription.value}
      note={imageError}
    >
      {#snippet control()}
        <div class="flex items-center gap-1">
          {#if appearance.background.image}
            <Button variant="ghost" size="sm" onclick={removeImage}>
              {$appearanceContent.removeImage.value}
            </Button>
          {/if}
          <Button variant="secondary" size="sm" onclick={chooseImage}>
            {appearance.background.image
              ? $appearanceContent.changeImage.value
              : $appearanceContent.chooseImage.value}
          </Button>
        </div>
      {/snippet}
    </SettingRow>

    {#if appearance.background.image}
      <SettingRow
        title={$appearanceContent.dimTitle.value}
        description={$appearanceContent.dimDescription.value}
      >
        {#snippet control()}
          <div class="flex items-center gap-3">
            <input
              type="range"
              aria-label={$appearanceContent.dimLabel.value}
              min="0"
              max={MAX_DIM * 100}
              step="5"
              class="h-9 w-40 cursor-pointer accent-accent"
              value={Math.round(appearance.background.dim * 100)}
              oninput={(e) => (appearance.background.dim = Number(e.currentTarget.value) / 100)}
            />
            <span class="w-10 text-right text-sm text-fg-2 tabular-nums">
              {$appearanceContent.dimValue({
                percent: Math.round(appearance.background.dim * 100),
              }).value}
            </span>
          </div>
        {/snippet}
      </SettingRow>
    {/if}
  </SettingGroup>
</div>
