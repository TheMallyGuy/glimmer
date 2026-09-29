<script lang="ts">
    import { Menu, type MenuItem } from "$lib";
    import type { Mod } from "$lib/mods.svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        open?: boolean;
        x: number;
        y: number;
        /** the mod this menu acts on, or null while closed */
        mod: Mod | null;
        /** focus goes back here when the menu closes */
        returnFocus?: HTMLElement | null;
        onRename: (mod: Mod) => void;
        onOpenFolder: (mod: Mod) => void;
        onMoveTop: (mod: Mod) => void;
        onMoveBottom: (mod: Mod) => void;
        onDelete: (mod: Mod) => void;
    }

    let {
        open = $bindable(false),
        x,
        y,
        mod,
        returnFocus = null,
        onRename,
        onOpenFolder,
        onMoveTop,
        onMoveBottom,
        onDelete,
    }: Props = $props();

    const items = $derived.by((): MenuItem[] => {
        if (!mod) return [];
        const m = mod;
        return [
            { label: $_("modContextMenu.rename"), shortcut: "F2", onselect: () => onRename(m) },
            { label: $_("modContextMenu.openFolder"), onselect: () => onOpenFolder(m) },
            {
                label: $_("modContextMenu.moveToTop"),
                separator: true,
                onselect: () => onMoveTop(m),
            },
            { label: $_("modContextMenu.moveToBottom"), onselect: () => onMoveBottom(m) },
            {
                label: $_("modContextMenu.delete"),
                shortcut: "Del",
                danger: true,
                separator: true,
                onselect: () => onDelete(m),
            },
        ];
    });
</script>

<Menu bind:open {x} {y} {items} label={$_("modContextMenu.modActions")} {returnFocus} />
