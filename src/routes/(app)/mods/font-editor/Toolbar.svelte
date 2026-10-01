<script lang="ts">
    import { Dropdown, SearchField } from "$lib";
    import { editor, selectFont, shownGlyphs } from "$lib/iconEditor.svelte";
    import { _ } from "svelte-i18n";
</script>

<div class="flex flex-wrap items-center gap-2">
    <SearchField
        label={$_("modsFontEditor.searchIcons")}
        bind:value={editor.query}
        width="260px"
    />
    {#if editor.fonts.length > 1}
        <Dropdown
            label={$_("modsFontEditor.fontLabel")}
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
        {$_("modsFontEditor.iconCount", {
            values: { shown: shownGlyphs().length, all: editor.glyphs.length },
        })}
    </span>
</div>
