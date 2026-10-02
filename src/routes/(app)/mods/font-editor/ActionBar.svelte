<script lang="ts">
    import { Button, Switch, cn } from "$lib";
    import { dictText } from "$lib/utils";
    import {
        editedTotal,
        editor,
        exportMod,
        exportTtf,
        previewFont,
    } from "$lib/iconEditor.svelte";
    import { useIntlayer } from "svelte-intlayer";
    const modsFontEditorContent = useIntlayer("modsFontEditor");

    const message = $derived(editor.message);
</script>

<div class="sticky bottom-0 flex flex-col gap-1 bg-canvas py-3">
    <div class="flex flex-wrap items-center gap-2">
        <span class="text-[13px] text-muted">
            {$modsFontEditorContent.editedCount(editedTotal())({ count: editedTotal() }).value}
        </span>
        {#if editor.previews[editor.fontPath]}
            <Switch
                label={$modsFontEditorContent.showPreview.value}
                size="sm"
                bind:checked={editor.showPreview}
            />
            <span class="text-[13px] text-muted"
                >{$modsFontEditorContent.showPreview.value}</span
            >
        {/if}
        <div class="ml-auto flex items-center gap-2">
            <Button
                variant="secondary"
                disabled={!!editor.busy}
                onclick={previewFont}
            >
                {editor.busy === "preview"
                    ? $modsFontEditorContent.previewing.value
                    : $modsFontEditorContent.preview.value}
            </Button>
            <Button
                variant="secondary"
                disabled={!!editor.busy}
                onclick={exportTtf}
            >
                {$modsFontEditorContent.exportTtf.value}
            </Button>
            <Button disabled={!!editor.busy} onclick={exportMod}>
                {editor.busy === "mod"
                    ? $modsFontEditorContent.exportingMod.value
                    : $modsFontEditorContent.exportMod.value}
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
            {dictText($modsFontEditorContent[message.key], message.values)}
        {/if}
    </p>
</div>
