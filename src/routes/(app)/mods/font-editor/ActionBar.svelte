<script lang="ts">
    import { Button, Switch, cn } from "$lib";
    import {
        editedTotal,
        editor,
        exportMod,
        exportTtf,
        previewFont,
    } from "$lib/iconEditor.svelte";
    import { _ } from "svelte-i18n";

    const message = $derived(editor.message);
</script>

<div class="sticky bottom-0 flex flex-col gap-1 bg-canvas py-3">
    <div class="flex flex-wrap items-center gap-2">
        <span class="text-[13px] text-muted">
            {$_("modsFontEditor.editedCount", {
                values: { count: editedTotal() },
            })}
        </span>
        {#if editor.previews[editor.fontPath]}
            <Switch
                label={$_("modsFontEditor.showPreview")}
                size="sm"
                bind:checked={editor.showPreview}
            />
            <span class="text-[13px] text-muted"
                >{$_("modsFontEditor.showPreview")}</span
            >
        {/if}
        <div class="ml-auto flex items-center gap-2">
            <Button
                variant="secondary"
                disabled={!!editor.busy}
                onclick={previewFont}
            >
                {editor.busy === "preview"
                    ? $_("modsFontEditor.previewing")
                    : $_("modsFontEditor.preview")}
            </Button>
            <Button
                variant="secondary"
                disabled={!!editor.busy}
                onclick={exportTtf}
            >
                {$_("modsFontEditor.exportTtf")}
            </Button>
            <Button disabled={!!editor.busy} onclick={exportMod}>
                {editor.busy === "mod"
                    ? $_("modsFontEditor.exportingMod")
                    : $_("modsFontEditor.exportMod")}
            </Button>
        </div>
    </div>

    <p
        class={cn(
            "m-0 min-h-5 text-[13px]",
            message?.error ? "text-danger" : "text-muted",
        )}
        aria-live="polite"
    >
        {#if message}
            {$_(`modsFontEditor.${message.key}`, { values: message.values })}
        {/if}
    </p>
</div>
