<script lang="ts">
    import type { Snippet } from "svelte";
    import { page } from "$app/state";
    import { InspiredBanner, cn } from "$lib";
    import { mods } from "$lib/mods.svelte";
    import { _ } from "svelte-i18n";

    let { children }: { children: Snippet } = $props();

    const views = $derived([
        { href: "/mods/manage", label: $_("modsLayout.yourMods"), count: mods.list.length },
        { href: "/mods/prebuilt", label: $_("modsLayout.builtIn") },
        { href: "/mods/community", label: $_("modsLayout.community") },
    ]);
</script>

<nav aria-label={$_("modsLayout.modViewsNav")} class="mb-5 flex gap-1">

    {#each views as view (view.href)}

        {@const current = page.url.pathname.startsWith(view.href)}

        <a
            href={view.href}
            aria-current={current ? "page" : undefined}
            class={cn(
                "relative flex h-9 items-center gap-2 px-3 font-display text-[15px] tracking-[0.01em] no-underline transition-colors motion-reduce:transition-none",
                current ? "text-white" : "text-fg-3 hover:text-fg",
            )}
        >

            {view.label}

            {#if view.count !== undefined}
                <span
                    class={cn(
                        "font-mono text-xs tabular-nums",
                        current ? "text-accent" : "text-subtle",
                    )}>{view.count}</span
                >
            {/if}

            <span
                class={cn(
                    "absolute inset-x-3 bottom-0 h-0.5",
                    current ? "bg-accent" : "bg-transparent",
                )}
            ></span>
        </a>

    {/each}

</nav>


{@render children()}


<div class="mt-14 mb-2 flex justify-center">

    <InspiredBanner />

</div>
