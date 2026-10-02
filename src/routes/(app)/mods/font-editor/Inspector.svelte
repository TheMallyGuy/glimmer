<script lang="ts">
    import { Button, Switch } from "$lib";
    import {
        DEFAULT_COLOR,
        baseName,
        fontFamily,
        pickArt,
        resetSelected,
        selectedEdit,
        selectedGlyph,
        setColor,
        setGradient,
    } from "$lib/iconEditor.svelte";
    import { useIntlayer } from "svelte-intlayer";
    const modsFontEditorContent = useIntlayer("modsFontEditor");

    const glyph = $derived(selectedGlyph());
    const edit = $derived(selectedEdit());
    const isGradient = $derived((edit?.colors?.length ?? 0) > 1);

    const swatch =
        "h-9 w-12 cursor-pointer rounded-gl border-0 bg-field p-0";
    const heading =
        "m-0 font-display text-[15px] font-normal tracking-[0.01em]";
</script>

<aside
    class="sticky top-0 flex w-[280px] shrink-0 flex-col gap-5 bg-row px-[18px] py-4"
    aria-label={$modsFontEditorContent.inspector.value}
>
    {#if glyph}
        <div class="flex flex-col items-center gap-1 bg-field py-5">
            <span
                class="text-[64px] leading-[76px] text-fg"
                style:font-family="'{fontFamily()}'"
                aria-hidden="true">{String.fromCodePoint(glyph.codepoint)}</span
            >
            <span class="max-w-full truncate text-[15px] font-medium"
                >{glyph.name}</span
            >
            <span class="font-mono text-xs text-subtle"
                >U+{glyph.codepoint.toString(16).toUpperCase()}</span
            >
        </div>

        <section class="flex flex-col gap-2">
            <h3 class={heading}>{$modsFontEditorContent.recolor.value}</h3>
            <div class="flex flex-wrap items-center gap-3">
                <label class="flex items-center gap-2 text-[13px] text-muted">
                    {isGradient
                        ? $modsFontEditorContent.gradientStart.value
                        : $modsFontEditorContent.flatColor.value}
                    <input
                        type="color"
                        class={swatch}
                        value={edit?.colors?.[0] ?? DEFAULT_COLOR}
                        disabled={!!edit?.art}
                        oninput={(e) => setColor(0, e.currentTarget.value)}
                    />
                </label>
                {#if isGradient}
                    <label
                        class="flex items-center gap-2 text-[13px] text-muted"
                    >
                        {$modsFontEditorContent.gradientEnd.value}
                        <input
                            type="color"
                            class={swatch}
                            value={edit?.colors?.[1] ?? DEFAULT_COLOR}
                            oninput={(e) => setColor(1, e.currentTarget.value)}
                        />
                    </label>
                {/if}
            </div>
            <div class="flex items-center gap-2">
                <Switch
                    label={$modsFontEditorContent.gradient.value}
                    size="sm"
                    checked={isGradient}
                    disabled={!!edit?.art}
                    onchange={setGradient}
                />
                <span class="text-[13px] text-muted"
                    >{$modsFontEditorContent.gradient.value}</span
                >
            </div>
        </section>

        <section class="flex flex-col gap-2">
            <h3 class={heading}>{$modsFontEditorContent.replaceArt.value}</h3>
            <p class="m-0 text-[13px] break-words text-muted">
                {edit?.art
                    ? $modsFontEditorContent.usingArt({ file: baseName(edit.art.path) }).value
                    : $modsFontEditorContent.replaceNote.value}
            </p>
            <div>
                <Button variant="secondary" size="sm" onclick={pickArt}>
                    {edit?.art
                        ? $modsFontEditorContent.changeArt.value
                        : $modsFontEditorContent.chooseArt.value}
                </Button>
            </div>
        </section>

        <div>
            <Button
                variant="ghost"
                size="sm"
                disabled={!edit}
                onclick={resetSelected}
            >
                {$modsFontEditorContent.resetIcon.value}
            </Button>
        </div>
    {:else}
        <p class="m-0 py-6 text-center text-[13px] text-muted">
            {$modsFontEditorContent.selectHint.value}
        </p>
    {/if}
</aside>
