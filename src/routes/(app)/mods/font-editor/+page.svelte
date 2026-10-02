<script lang="ts">
    import { onMount } from "svelte";
    import { editor, initEditor } from "$lib/iconEditor.svelte";
    import { dictText } from "$lib/utils";
    import ActionBar from "./ActionBar.svelte";
    import IconGrid from "./IconGrid.svelte";
    import Inspector from "./Inspector.svelte";
    import Toolbar from "./Toolbar.svelte";
    import { useIntlayer } from "svelte-intlayer";
    const modsCommunityContent = useIntlayer("modsCommunity");
    const modsFontEditorContent = useIntlayer("modsFontEditor");

    onMount(() => {
        // keep edits when coming back to the tab
        if (editor.status === "loading") initEditor();
    });
</script>

<div class="flex flex-col gap-4">
    <p class="m-0 max-w-[520px] text-sm text-muted">
        {$modsFontEditorContent.intro.value}
    </p>

    {#if editor.status === "loading"}
        <p
            class="m-0 bg-row px-[18px] py-8 text-sm text-muted"
            aria-live="polite"
        >
            {$modsCommunityContent.loading.value}
        </p>
    {:else if editor.status === "empty" || editor.status === "error"}
        <p
            class="m-0 bg-row px-[18px] py-8 text-sm text-muted"
            aria-live="polite"
        >
            {editor.status === "error" && editor.message
                ? dictText(
                      $modsFontEditorContent[editor.message.key],
                      editor.message.values,
                  )
                : $modsFontEditorContent.noFonts.value}
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
