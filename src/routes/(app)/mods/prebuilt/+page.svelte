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
  import { _ } from "svelte-i18n";

  let appliedCursor = prebuilt.cursor;

  const cursors = [
    { value: "default", label: $_("modsPrebuilt.cursorDefault") },
    { value: "2006", label: $_("modsPrebuilt.cursor2006") },
    { value: "2013", label: $_("modsPrebuilt.cursor2013") },
    { value: "purple-cross", label: $_("modsPrebuilt.cursorPurpleCross") },
    { value: "dot", label: $_("modsPrebuilt.cursorDot") },
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
  <SettingGroup label={$_("modsPrebuilt.presetsGroup")}>
    <SettingRow
      title={$_("modsPrebuilt.mouseCursor")}
      description={$_("modsPrebuilt.mouseCursorDescription")}
    >
      {#snippet control()}
        <Dropdown
          label={$_("modsPrebuilt.mouseCursor")}
          size="sm"
          width="200px"
          options={cursors}
          bind:value={prebuilt.cursor}
          onchange={changeCursor}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$_("modsPrebuilt.oldCharacterSounds")}
      description={$_("modsPrebuilt.oldCharacterSoundsDescription")}
    >
      {#snippet control()}
        <Switch
          label={$_("modsPrebuilt.oldCharacterSounds")}
          bind:checked={prebuilt.oldSounds}
          onchange={changeOldSounds}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$_("modsPrebuilt.oldAvatarBackground")}
      description={$_("modsPrebuilt.oldAvatarBackgroundDescription")}
    >
      {#snippet control()}
        <Switch
          label={$_("modsPrebuilt.oldAvatarBackground")}
          bind:checked={prebuilt.oldAvatarBackground}
          onchange={changeOldAvatarBackground}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>

  <SettingGroup label={$_("modsPrebuilt.yourFilesGroup")}>
    <SettingRow
      title={$_("modsPrebuilt.customFont")}
      description={prebuilt.font
        ? $_("modsPrebuilt.usingFile", {
            values: { file: fileName(prebuilt.font) },
          })
        : $_("modsPrebuilt.customFontDescription")}
    >
      {#snippet control()}
        <div class="flex gap-1">
          {#if prebuilt.font}
            <Button
              variant="ghost"
              size="sm"
              onclick={() => setFont(null)}
              >{$_("common.remove")}</Button
            >
          {/if}
          <Button size="sm" onclick={() => pick("font")}
            >{prebuilt.font
              ? $_("modsPrebuilt.changeFont")
              : $_("modsPrebuilt.chooseFont")}</Button
          >
        </div>
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$_("modsPrebuilt.customDeathSound")}
      description={prebuilt.deathSound
        ? $_("modsPrebuilt.usingFile", {
            values: { file: fileName(prebuilt.deathSound) },
          })
        : $_("modsPrebuilt.customDeathSoundDescription")}
    >
      {#snippet control()}
        <div class="flex gap-1">
          {#if prebuilt.deathSound}
            <Button
              variant="ghost"
              size="sm"
              onclick={() => setDeathSound(null)}
              >{$_("common.remove")}</Button
            >
          {/if}
          <Button size="sm" onclick={() => pick("deathSound")}
            >{prebuilt.deathSound
              ? $_("modsPrebuilt.changeSound")
              : $_("modsPrebuilt.chooseSound")}</Button
          >
        </div>
      {/snippet}
    </SettingRow>
  </SettingGroup>
</div>
