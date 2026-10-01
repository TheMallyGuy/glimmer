<script lang="ts">
    import { onMount } from "svelte";
    import { editor, initEditor } from "$lib/iconEditor.svelte";
    import { _ } from "svelte-i18n";
    import ActionBar from "./ActionBar.svelte";
    import IconGrid from "./IconGrid.svelte";
    import Inspector from "./Inspector.svelte";
    import Toolbar from "./Toolbar.svelte";

    onMount(() => {
        // keep edits when coming back to the tab
        if (editor.status === "loading") initEditor();
    });
</script>

<div class="flex flex-col gap-4">
    <p class="m-0 max-w-[520px] text-sm text-muted">
        {$_("modsFontEditor.intro")}
    </p>

    {#if editor.status === "loading"}
        <p
            class="m-0 bg-row px-[18px] py-8 text-sm text-muted"
            aria-live="polite"
        >
            {$_("modsCommunity.loading")}
        </p>
    {:else if editor.status === "empty" || editor.status === "error"}
        <p
            class="m-0 bg-row px-[18px] py-8 text-sm text-muted"
            aria-live="polite"
        >
            {editor.status === "error" && editor.message
                ? $_(`modsFontEditor.${editor.message.key}`, {
                      values: editor.message.values,
                  })
                : $_("modsFontEditor.noFonts")}
        </p>
    {:else}
        <Toolbar />
        <div class="flex items-start gap-0.5">
            <IconGrid />
            <Inspector />
        </div>
        <ActionBar />
    {/if}
</div>
