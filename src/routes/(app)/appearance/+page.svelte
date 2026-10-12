<script lang="ts">
  import { Check } from "@lucide/svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { Button, SettingGroup, SettingRow, TextField, cn } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { ACCENT_PRESETS, AccentTheme, DEFAULT_ACCENT } from "$ts/theme";
  import {
    BACKGROUND_PRESETS,
    BackgroundImage,
    BackgroundTheme,
    IMAGE_EXTENSIONS,
    MAX_DIM,
  } from "$ts/glimmer/background";
  import { useIntlayer } from "svelte-intlayer";
  const appearanceContent = useIntlayer("appearance");

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
    if (parsedBackground && !backgroundError)
      appearance.background.color = parsedBackground;
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
              oninput={(e) =>
                (appearance.background.dim =
                  Number(e.currentTarget.value) / 100)}
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
