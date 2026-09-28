<script lang="ts">
    import { onMount, onDestroy, tick } from "svelte";
    import { goto } from "$app/navigation";
    import { Plus, FolderOpen } from "@lucide/svelte";
    import { Button } from "$lib";
    import ModContextMenu from "./ModContextMenu.svelte";
    import ModList from "./ModList.svelte";
    import type { DndEvent } from "svelte-dnd-action";
    import {
        mods,
        loadMods,
        createMod,
        renameMod,
        moveMod,
        reorderMods,
        openModFolder,
        nameTaken,
        removeMod,
        restoreMod,
        commitDelete,
        type Mod,
    } from "$lib/mods.svelte";

    onMount(loadMods);

    const enabledCount = $derived(mods.list.filter((m) => m.enabled).length);

    // Inline naming (new mod and rename share this).
    let editingId = $state<string | null>(null); // a mod id, or "new"
    let draft = $state("");
    let editError = $state("");
    let editInput = $state<HTMLInputElement>();
    let nameButtons: Record<string, HTMLButtonElement> = $state({});

    async function startNew() {
        editingId = "new";
        draft = "";
        editError = "";
        await tick();
        editInput?.focus();
    }

    async function startRename(mod: Mod) {
        editingId = mod.id;
        draft = mod.name;
        editError = "";
        await tick();
        editInput?.select();
    }

    function validate(name: string, id?: string) {
        if (!name) return "Needs a name";
        if (nameTaken(name, id)) return "Name already used";
        return "";
    }

    /** keepOpen: on Enter, stay in the field if the name is invalid. */
    async function commitEdit(keepOpen: boolean) {
        const id = editingId;
        if (!id) return;
        const name = draft.trim();
        const isNew = id === "new";
        const current = isNew ? null : mods.list.find((m) => m.id === id);

        if (current && name === current.name) return finish(current.id);

        const error = validate(name, current?.id);
        if (error) {
            if (keepOpen) return (editError = error);
            return finish(current?.id); // blur with a bad name: drop the change
        }

        editingId = null;
        if (isNew) {
            const mod = await createMod(name);
            announce(`Created ${name}.`);
            await tick();
            nameButtons[mod.id]?.focus();
        } else if (current) {
            await renameMod(current.id, name);
            announce(`Renamed to ${name}.`);
            finish(current.id);
        }
    }

    async function finish(focusId?: string) {
        editingId = null;
        editError = "";
        await tick();
        if (focusId) nameButtons[focusId]?.focus();
    }

    function onEditKey(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            commitEdit(true);
        } else if (e.key === "Escape") {
            e.preventDefault();
            const id = editingId;
            finish(id && id !== "new" ? id : undefined);
        }
    }

    // Delete with undo.
    let undo = $state<{ mod: Mod; index: number } | null>(null);
    let undoTimer: ReturnType<typeof setTimeout> | undefined;

    async function remove(mod: Mod) {
        flushUndo();
        const i = mods.list.indexOf(mod);
        const next = mods.list[i + 1] ?? mods.list[i - 1];
        const removed = removeMod(mod.id);
        if (!removed) return;
        undo = removed;
        undoTimer = setTimeout(flushUndo, 6000);
        announce(`Deleted ${mod.name}. Press Undo to bring it back.`);
        await tick();
        if (next) nameButtons[next.id]?.focus();
    }

    function flushUndo() {
        clearTimeout(undoTimer);
        if (undo) commitDelete(undo.mod);
        undo = null;
    }

    async function undoDelete() {
        clearTimeout(undoTimer);
        if (!undo) return;
        const { mod, index } = undo;
        restoreMod(mod, index);
        undo = null;
        announce(`Restored ${mod.name}.`);
        await tick();
        nameButtons[mod.id]?.focus();
    }

    onDestroy(flushUndo);

    // Menu (right-click or the … button).
    let menu = $state({
        open: false,
        x: 0,
        y: 0,
        mod: null as Mod | null,
        from: null as HTMLElement | null,
    });

    function openMenuAt(
        x: number,
        y: number,
        mod: Mod,
        from: HTMLElement | null,
    ) {
        menu = { open: true, x, y, mod, from };
    }

    function openMenuFrom(el: HTMLElement, mod: Mod) {
        const r = el.getBoundingClientRect();
        openMenuAt(r.right - 208, r.bottom + 4, mod, el);
    }

    function onNameKey(e: KeyboardEvent, mod: Mod) {
        if (e.key === "F2") {
            e.preventDefault();
            startRename(mod);
        } else if (e.key === "Delete") {
            e.preventDefault();
            remove(mod);
        } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
            e.preventDefault();
            openMenuFrom(e.currentTarget as HTMLElement, mod);
        }
    }

    // Reordering.
    let handles: HTMLButtonElement[] = $state([]);
    let announcement = $state("");

    async function move(from: number, to: number) {
        if (from < 0 || to < 0 || to >= mods.list.length || from === to) return;
        const name = mods.list[from].name;
        await moveMod(from, to);
        announce(`Moved ${name} to position ${to + 1} of ${mods.list.length}.`);
    }

    async function onHandleKey(e: KeyboardEvent, i: number) {
        const to =
            e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : null;
        if (to === null) return;
        e.preventDefault();
        await move(i, to);
        await tick();
        handles[Math.max(0, Math.min(to, mods.list.length - 1))]?.focus();
    }

    function onDndConsider(e: CustomEvent<DndEvent<Mod>>) {
        mods.list.splice(0, mods.list.length, ...e.detail.items);
    }

    async function onDndFinalize(e: CustomEvent<DndEvent<Mod>>) {
        await reorderMods(e.detail.items);
    }

    function announce(text: string) {
        announcement = text;
    }
</script>

<div class="flex flex-col gap-3">
    <div class="flex items-center gap-1">
        <p class="m-0 grow text-[13px] text-muted">
            {#if mods.list.length}
                {mods.list.length}
                {mods.list.length === 1 ? "mod" : "mods"}, {enabledCount} on
            {/if}
        </p>
        <Button variant="ghost" size="sm" onclick={() => openModFolder()}>
            <FolderOpen size={16} strokeWidth={1.75} aria-hidden="true" /> Open folder
        </Button>
        <Button
            variant="primary"
            size="sm"
            onclick={startNew}
            disabled={editingId === "new"}
        >
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" /> New mod
        </Button>
    </div>

    {#if mods.list.length === 0 && editingId !== "new"}
        <div class="flex flex-col items-start gap-3 bg-row px-[18px] py-8">
            <p class="m-0 text-sm text-muted">
                No mods yet. Create one, or install one from Community!
            </p>
            <div class="flex gap-1">
                <Button size="sm" onclick={startNew}>Create a mod</Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => goto("/mods/community")}
                    >Browse community mods</Button
                >
            </div>
        </div>
    {:else}
        <ModList
            bind:editingId
            bind:draft
            bind:editError
            bind:editInput
            bind:nameButtons
            bind:handles
            menuMod={menu.open ? menu.mod : null}
            onStartRename={startRename}
            onCommitEdit={commitEdit}
            {onEditKey}
            {onNameKey}
            {onHandleKey}
            onOpenMenuAt={openMenuAt}
            onOpenMenuFrom={openMenuFrom}
            {onDndConsider}
            {onDndFinalize}
        />
    {/if}

    {#if undo}
        <div class="flex h-11 items-center gap-3 bg-tonal pr-1 pl-[18px]">
            <span class="min-w-0 grow truncate text-sm text-fg-2"
                >Deleted {undo.mod.name}</span
            >
            <Button
                variant="ghost"
                size="sm"
                class="text-accent hover:enabled:text-accent"
                onclick={undoDelete}>Undo</Button
            >
        </div>
    {/if}

    {#if mods.list.length}
        <p class="m-0 text-[13px] text-muted">
            Tip: Top of the list wins when two mods change the same file. Click a
            name to rename it, or right-click a mod for more!
        </p>
    {/if}

    <p class="sr-only" aria-live="polite">{announcement}</p>
</div>

<ModContextMenu
    bind:open={menu.open}
    x={menu.x}
    y={menu.y}
    mod={menu.mod}
    returnFocus={menu.from}
    onRename={startRename}
    onOpenFolder={openModFolder}
    onMoveTop={(mod) => move(mods.list.indexOf(mod), 0)}
    onMoveBottom={(mod) => move(mods.list.indexOf(mod), mods.list.length - 1)}
    onDelete={remove}
/>
