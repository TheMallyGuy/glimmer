<script lang="ts">
    import { Dropdown, SearchField } from "$lib";
    import { editor, selectFont, shownGlyphs } from "$lib/iconEditor.svelte";
    import { useIntlayer } from "svelte-intlayer";
    const modsFontEditorContent = useIntlayer("modsFontEditor");
</script>

<div class="flex flex-wrap items-center gap-2">
    <SearchField
        label={$modsFontEditorContent.searchIcons.value}
        bind:value={editor.query}
        width="260px"
    />
    {#if editor.fonts.length > 1}
        <Dropdown
            label={$modsFontEditorContent.fontLabel.value}
            size="sm"
            width="180px"
            options={editor.fonts.map((f) => ({
                value: f.path,
                label: f.label,
            }))}
            value={editor.fontPath}
            onchange={selectFont}
        />
    {/if}
    <span class="ml-auto text-[13px] text-muted">
        {$modsFontEditorContent.iconCount({ shown: shownGlyphs().length, all: editor.glyphs.length }).value}
    </span>
</div>
