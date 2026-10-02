<script lang="ts">
    import { GripVertical, Ellipsis } from "@lucide/svelte";
    import { IconButton, Switch, cn } from "$lib";
    import {
        dragHandleZone,
        dragHandle,
        type DndEvent,
    } from "svelte-dnd-action";
    import { mods, setEnabled, type Mod } from "$lib/mods.svelte";
    import { useIntlayer } from "svelte-intlayer";
    const modListContent = useIntlayer("modList");

    interface Props {
        editingId: string | null;
        draft: string;
        editError: string;
        editInput?: HTMLInputElement;
        nameButtons: Record<string, HTMLButtonElement>;
        handles: HTMLButtonElement[];
        /** the mod the context menu is currently open for, or null */
        menuMod: Mod | null;
        onStartRename: (mod: Mod) => void;
        onCommitEdit: (keepOpen: boolean) => void;
        onEditKey: (e: KeyboardEvent) => void;
        onNameKey: (e: KeyboardEvent, mod: Mod) => void;
        onHandleKey: (e: KeyboardEvent, i: number) => void;
        onOpenMenuAt: (
            x: number,
            y: number,
            mod: Mod,
            from: HTMLElement | null,
        ) => void;
        onOpenMenuFrom: (el: HTMLElement, mod: Mod) => void;
        onDndConsider: (e: CustomEvent<DndEvent<Mod>>) => void;
        onDndFinalize: (e: CustomEvent<DndEvent<Mod>>) => void;
    }

    let {
        editingId = $bindable(),
        draft = $bindable(),
        editError = $bindable(),
        editInput = $bindable(),
        nameButtons = $bindable(),
        handles = $bindable(),
        menuMod,
        onStartRename,
        onCommitEdit,
        onEditKey,
        onNameKey,
        onHandleKey,
        onOpenMenuAt,
        onOpenMenuFrom,
        onDndConsider,
        onDndFinalize,
    }: Props = $props();
</script>

<ul
    use:dragHandleZone={{ items: mods.list, flipDurationMs: 150 }}
    onconsider={onDndConsider}
    onfinalize={onDndFinalize}
    class="m-0 flex list-none flex-col gap-0.5 p-0"
    aria-label={$modListContent.yourModsList.value}
>
    {#if editingId === "new"}
        <li class="flex h-12 items-center gap-2 bg-tonal pr-2 pl-9">
            <input
                bind:this={editInput}
                bind:value={draft}
                aria-label={$modListContent.newModName.value}
                aria-invalid={editError ? true : undefined}
                placeholder={$modListContent.newModNamePlaceholder.value}
                autocomplete="off"
                spellcheck="false"
                class={cn(
                    "h-8 min-w-0 grow rounded-gl border-0 bg-field px-2 text-[15px] text-fg placeholder:text-subtle focus:outline-2 focus:outline-accent",
                    editError && "outline-2 outline-danger",
                )}
                oninput={() => (editError = "")}
                onkeydown={onEditKey}
                onblur={() => onCommitEdit(false)}
            />
            {#if editError}
                <span class="shrink-0 text-xs text-danger">{editError}</span>
            {/if}
        </li>
    {/if}

    {#each mods.list as mod, i (mod.id)}
        {@const editing = editingId === mod.id}
        {@const menuOpen = menuMod === mod}
        <li
            class={cn(
                "group relative flex h-12 items-center gap-2 pr-1 pl-1 transition-colors motion-reduce:transition-none",
                editing || menuOpen ? "bg-tonal" : "bg-row hover:bg-hover",
            )}
            oncontextmenu={(e) => {
                e.preventDefault();
                onOpenMenuAt(e.clientX, e.clientY, mod, nameButtons[mod.id]);
            }}
        >
            <button
                bind:this={handles[i]}
                type="button"
                use:dragHandle
                aria-label={$modListContent.reorderMod({ name: mod.name }).value}
                class="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-gl border-0 bg-transparent text-subtle opacity-0 group-hover:opacity-100 hover:text-fg-2 focus-visible:opacity-100 active:cursor-grabbing"
                onkeydown={(e) => onHandleKey(e, i)}
            >
                <GripVertical size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>

            <Switch
                label={$modListContent.enableMod({ name: mod.name }).value}
                checked={mod.enabled}
                onchange={(v) => setEnabled(mod.id, v)}
            />

            {#if editing}
                <input
                    bind:this={editInput}
                    bind:value={draft}
                    aria-label={$modListContent.renameMod({ name: mod.name }).value}
                    aria-invalid={editError ? true : undefined}
                    autocomplete="off"
                    spellcheck="false"
                    class={cn(
                        "ml-1 h-8 min-w-0 grow rounded-gl border-0 bg-field px-2 text-[15px] font-medium text-fg focus:outline-2 focus:outline-accent",
                        editError && "outline-2 outline-danger",
                    )}
                    oninput={() => (editError = "")}
                    onkeydown={onEditKey}
                    onblur={() => onCommitEdit(false)}
                />
                {#if editError}
                    <span class="shrink-0 pr-2 text-xs text-danger"
                        >{editError}</span
                    >
                {/if}
            {:else}
                <button
                    bind:this={nameButtons[mod.id]}
                    type="button"
                    title={$modListContent.clickToRename.value}
                    class={cn(
                        "ml-1 h-8 min-w-0 grow cursor-text truncate rounded-gl border-0 bg-transparent px-2 text-left text-[15px] font-medium hover:bg-tonal",
                        mod.enabled ? "text-fg" : "text-off",
                    )}
                    onclick={() => onStartRename(mod)}
                    onkeydown={(e) => onNameKey(e, mod)}
                >
                    {mod.name}
                </button>
            {/if}

            {#if !editing}
                <IconButton
                    label={$modListContent.moreForMod({ name: mod.name }).value}
                    variant="ghost"
                    size="sm"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    class={cn(
                        "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                        menuOpen && "opacity-100",
                    )}
                    onclick={(e) =>
                        onOpenMenuFrom(e.currentTarget as HTMLElement, mod)}
                >
                    <Ellipsis size={16} strokeWidth={1.75} aria-hidden="true" />
                </IconButton>
            {/if}
        </li>
    {/each}
</ul>
