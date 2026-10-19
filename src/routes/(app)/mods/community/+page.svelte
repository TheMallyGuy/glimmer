<script lang="ts">
    import { onMount } from "svelte";
    import { Download, Check, RotateCw } from "@lucide/svelte";
    import { Button, SearchField, cn } from "$lib";
    import {
        fetchCommunityMods,
        sourceNames,
        type CommunityMod,
        type CommunitySource,
    } from "$ts/roblox/mod/community";
    import { installs, installCommunityMod } from "$lib/mods.svelte";
    import { useIntlayer } from "svelte-intlayer";
    const commonContent = useIntlayer("common");
    const modsCommunityContent = useIntlayer("modsCommunity");

    let all = $state<CommunityMod[]>([]);
    let failed = $state<CommunitySource[]>([]);
    let status = $state<"loading" | "ready" | "error">("loading");
    /** Selected library, or null to show every library. */
    let filter = $state<CommunitySource | null>(null);
    let query = $state("");

    const sourceFilters = $derived(
        [...new Set(all.map((m) => m.source))].map((s) => ({
            id: s,
            label: sourceNames[s],
        })),
    );

    const shown = $derived.by(() => {
        const q = query.trim().toLowerCase();
        return all.filter((m) => {
            const byFilter = !filter || m.source === filter;
            const byQuery =
                !q ||
                m.name.toLowerCase().includes(q) ||
                (m.author ?? "").toLowerCase().includes(q);
            return byFilter && byQuery;
        });
    });

    async function load(force = false) {
        status = "loading";
        const res = await fetchCommunityMods(force);
        all = res.mods;
        failed = res.failed;
        status = res.mods.length ? "ready" : "error";
    }

    onMount(() => load());

    function chip(active: boolean) {
        return cn(
            "h-8 cursor-pointer rounded-gl border-0 px-3 text-[13px] transition-colors motion-reduce:transition-none",
            active
                ? "bg-accent/15 text-accent"
                : "bg-row text-fg-3 hover:bg-hover hover:text-fg",
        );
    }
</script>

{#if status === "loading"}
    <p class="m-0 bg-row px-[18px] py-8 text-sm text-muted" aria-live="polite">
        {$modsCommunityContent.loading.value}
    </p>
{:else if status === "error"}
    <div class="flex flex-col items-start gap-3 bg-row px-[18px] py-8">
        <p class="m-0 text-sm text-muted">
            {$modsCommunityContent.loadError.value}
        </p>
        <Button size="sm" onclick={() => load(true)}>
            <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" />
            {$commonContent.tryAgain.value}
        </Button>
    </div>
{:else}
    <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-2">
            <SearchField
                label={$modsCommunityContent.searchCommunityMods.value}
                bind:value={query}
                width="260px"
            />
            <div
                class="flex flex-wrap items-center gap-1"
                role="group"
                aria-label={$modsCommunityContent.filterGroupLabel.value}
            >
                {#each sourceFilters as f (f.id)}
                    <button
                        type="button"
                        class={chip(filter === f.id)}
                        aria-pressed={filter === f.id}
                        onclick={() => (filter = filter === f.id ? null : f.id)}
                        >{f.label}</button
                    >
                {/each}
            </div>
            <span class="ml-auto text-[13px] text-muted"
                >{$modsCommunityContent.shownOfAll({ shown: shown.length, all: all.length }).value}</span
            >
        </div>

        {#if failed.length}
            <p class="m-0 text-[13px] text-accent">
                {$modsCommunityContent.failedToLoad({
                        libraries: failed
                            .map((s) => sourceNames[s])
                            .join(" and "),
                    }).value}
                <button
                    type="button"
                    class="cursor-pointer border-0 bg-transparent p-0 text-accent underline"
                    onclick={() => load(true)}>{$commonContent.tryAgain.value}</button
                >
            </p>
        {/if}

        {#if shown.length === 0}
            <p class="m-0 bg-row px-[18px] py-8 text-sm text-muted">
                {$modsCommunityContent.emptyNoMatch.value}
            </p>
        {:else}
            <ul
                class="stagger m-0 grid list-none gap-2 p-0"
                style="grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));"
            >
                {#each shown as mod (mod.id)}
                    {@const state = installs[mod.id]}
                    <li class="group flex flex-col bg-row">
                        <div
                            class="relative aspect-video overflow-hidden bg-tonal"
                            style:background-image={mod.gradient}
                        >
                            {#if mod.thumbnail}
                                <img
                                    src={mod.thumbnail}
                                    alt=""
                                    loading="lazy"
                                    class="size-full object-cover opacity-0 transition-[opacity,scale] duration-200 group-hover:scale-[1.03] data-loaded:opacity-100 motion-reduce:transition-none"
                                    onload={(e) =>
                                        ((e.currentTarget as HTMLImageElement).dataset.loaded = "")}
                                    onerror={(e) =>
                                        ((
                                            e.currentTarget as HTMLImageElement
                                        ).style.display = "none")}
                                />
                            {/if}
                        </div>
                        <div class="flex grow flex-col gap-0.5 p-3">
                            <h3
                                class="m-0 truncate font-display text-sm font-normal tracking-[0.01em]"
                                title={mod.name}
                            >
                                {mod.name}
                            </h3>
                            <p class="m-0 truncate text-xs text-muted">
                                {mod.author
                                    ? $modsCommunityContent.byAuthor({ author: mod.author }).value
                                    : $modsCommunityContent.unknownAuthor.value}
                            </p>
                            <p class="m-0 truncate text-xs text-muted">
                                {sourceNames[mod.source]}
                            </p>

                            <div class="grow"></div>

                            <Button
                                size="sm"
                                variant={state === "installed"
                                    ? "ghost"
                                    : "secondary"}
                                class="mt-3 w-full"
                                disabled={state === "installing" ||
                                    state === "installed"}
                                aria-label="{state === 'installed'
                                    ? $modsCommunityContent.installedAriaLabel.value
                                    : $modsCommunityContent.installAriaLabel.value} {mod.name}"
                                onclick={() => installCommunityMod(mod)}
                            >
                                {#if state === "installing"}
                                    {$modsCommunityContent.installing.value}
                                {:else if state === "installed"}
                                    <Check
                                        size={16}
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                    />
                                    {$modsCommunityContent.installed.value}
                                {:else if state === "failed"}
                                    <RotateCw
                                        size={16}
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                    />
                                    {$modsCommunityContent.retryInstall.value}
                                {:else}
                                    <Download
                                        size={16}
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                    />
                                    {$modsCommunityContent.install.value}
                                {/if}
                            </Button>
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
{/if}
