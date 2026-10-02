<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { SettingGroup, SettingRow, Switch, Dropdown, Button } from "$lib";
  import {
    prebuilt,
    applyCursor,
    applyCustomFont,
    applyDeathSound,
    applyOldSounds,
    applyOldAvatarBackground,
  } from "$lib/mods.svelte";
  import { useIntlayer } from "svelte-intlayer";
  const commonContent = useIntlayer("common");
  const modsPrebuiltContent = useIntlayer("modsPrebuilt");

  let appliedCursor = prebuilt.cursor;

  const cursors = [
    { value: "default", label: $modsPrebuiltContent.cursorDefault.value },
    { value: "2006", label: $modsPrebuiltContent.cursor2006.value },
    { value: "2013", label: $modsPrebuiltContent.cursor2013.value },
    { value: "purple-cross", label: $modsPrebuiltContent.cursorPurpleCross.value },
    { value: "dot", label: $modsPrebuiltContent.cursorDot.value },
  ];

  async function changeCursor(value: string) {
    const previous = appliedCursor;
    try {
      await applyCursor(value);
      appliedCursor = value;
    } catch (err) {
      console.error(err);
      prebuilt.cursor = previous;
    }
  }

  async function changeOldSounds(enabled: boolean) {
    try {
      await applyOldSounds(enabled);
    } catch (err) {
      console.error(err);
      prebuilt.oldSounds = !enabled;
    }
  }

  async function changeOldAvatarBackground(enabled: boolean) {
    try {
      await applyOldAvatarBackground(enabled);
    } catch (err) {
      console.error(err);
      prebuilt.oldAvatarBackground = !enabled;
    }
  }

  const fileName = (path: string | null) => path?.split(/[\\/]/).pop() ?? null;

  async function setFont(path: string | null) {
    const previous = prebuilt.font;
    prebuilt.font = path;
    try {
      await applyCustomFont(path);
    } catch (err) {
      console.error(err);
      prebuilt.font = previous;
    }
  }

  async function setDeathSound(path: string | null) {
    const previous = prebuilt.deathSound;
    prebuilt.deathSound = path;
    try {
      await applyDeathSound(path);
    } catch (err) {
      console.error(err);
      prebuilt.deathSound = previous;
    }
  }

  async function pick(kind: "font" | "deathSound") {
    const path = await open({
      multiple: false,
      filters:
        kind === "font"
          ? [{ name: "Font", extensions: ["ttf", "otf"] }]
          : [{ name: "Sound", extensions: ["ogg", "mp3", "wav"] }],
    });
    if (typeof path !== "string") return;

    if (kind === "font") await setFont(path);
    else await setDeathSound(path);
  }
</script>

<div class="flex flex-col gap-7">
  <SettingGroup label={$modsPrebuiltContent.presetsGroup.value}>
    <SettingRow
      title={$modsPrebuiltContent.mouseCursor.value}
      description={$modsPrebuiltContent.mouseCursorDescription.value}
    >
      {#snippet control()}
        <Dropdown
          label={$modsPrebuiltContent.mouseCursor.value}
          size="sm"
          width="200px"
          options={cursors}
          bind:value={prebuilt.cursor}
          onchange={changeCursor}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$modsPrebuiltContent.oldCharacterSounds.value}
      description={$modsPrebuiltContent.oldCharacterSoundsDescription.value}
    >
      {#snippet control()}
        <Switch
          label={$modsPrebuiltContent.oldCharacterSounds.value}
          bind:checked={prebuilt.oldSounds}
          onchange={changeOldSounds}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$modsPrebuiltContent.oldAvatarBackground.value}
      description={$modsPrebuiltContent.oldAvatarBackgroundDescription.value}
    >
      {#snippet control()}
        <Switch
          label={$modsPrebuiltContent.oldAvatarBackground.value}
          bind:checked={prebuilt.oldAvatarBackground}
          onchange={changeOldAvatarBackground}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>

  <SettingGroup label={$modsPrebuiltContent.yourFilesGroup.value}>
    <SettingRow
      title={$modsPrebuiltContent.customFont.value}
      description={prebuilt.font
        ? $modsPrebuiltContent.usingFile({ file: fileName(prebuilt.font) }).value
        : $modsPrebuiltContent.customFontDescription.value}
    >
      {#snippet control()}
        <div class="flex gap-1">
          {#if prebuilt.font}
            <Button
              variant="ghost"
              size="sm"
              onclick={() => setFont(null)}
              >{$commonContent.remove.value}</Button
            >
          {/if}
          <Button size="sm" onclick={() => pick("font")}
            >{prebuilt.font
              ? $modsPrebuiltContent.changeFont.value
              : $modsPrebuiltContent.chooseFont.value}</Button
          >
        </div>
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$modsPrebuiltContent.customDeathSound.value}
      description={prebuilt.deathSound
        ? $modsPrebuiltContent.usingFile({ file: fileName(prebuilt.deathSound) }).value
        : $modsPrebuiltContent.customDeathSoundDescription.value}
    >
      {#snippet control()}
        <div class="flex gap-1">
          {#if prebuilt.deathSound}
            <Button
              variant="ghost"
              size="sm"
              onclick={() => setDeathSound(null)}
              >{$commonContent.remove.value}</Button
            >
          {/if}
          <Button size="sm" onclick={() => pick("deathSound")}
            >{prebuilt.deathSound
              ? $modsPrebuiltContent.changeSound.value
              : $modsPrebuiltContent.chooseSound.value}</Button
          >
        </div>
      {/snippet}
    </SettingRow>
  </SettingGroup>
</div>
