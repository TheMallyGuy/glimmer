<script lang="ts">
    import { cn } from "$lib";
    import {
        currentEdits,
        editor,
        fontFamily,
        shownGlyphs,
    } from "$lib/iconEditor.svelte";
    import { useIntlayer } from "svelte-intlayer";
    const modsFontEditorContent = useIntlayer("modsFontEditor");
</script>

<ul
    class="m-0 grid min-w-0 flex-1 list-none content-start gap-0.5 p-0"
    style="grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));"
>
    {#each shownGlyphs() as glyph (glyph.name)}
        {@const selected = editor.selected === glyph.name}
        {@const edited = !!currentEdits()[glyph.name]}
        <li>
            <button
                type="button"
                class={cn(
                    "relative flex w-full cursor-pointer flex-col items-center gap-1 rounded-gl border-0 px-2 py-3 transition-colors motion-reduce:transition-none",
                    selected ? "bg-hover" : "bg-row hover:bg-hover",
                )}
                aria-pressed={selected}
                aria-label={$modsFontEditorContent.editIcon({ name: glyph.name }).value}
                onclick={() => (editor.selected = glyph.name)}
            >
                <span
                    class={cn(
                        "text-[32px] leading-10",
                        selected ? "text-accent" : "text-fg",
                    )}
                    style:font-family="'{fontFamily()}'"
                    aria-hidden="true"
                    >{String.fromCodePoint(glyph.codepoint)}</span
                >
                <span
                    class={cn(
                        "w-full truncate text-center text-xs",
                        edited ? "text-accent" : "text-muted",
                    )}
                    title={glyph.name}>{glyph.name}</span
                >
                {#if selected}
                    <span
                        class="absolute inset-x-2 bottom-0 h-0.5 bg-accent"
                        aria-hidden="true"
                    ></span>
                {/if}
            </button>
        </li>
    {/each}
</ul>
