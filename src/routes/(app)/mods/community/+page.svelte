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
    import { _ } from "svelte-i18n";

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
        {$_("modsCommunity.loading")}
    </p>
{:else if status === "error"}
    <div class="flex flex-col items-start gap-3 bg-row px-[18px] py-8">
        <p class="m-0 text-sm text-muted">
            {$_("modsCommunity.loadError")}
        </p>
        <Button size="sm" onclick={() => load(true)}>
            <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" />
            {$_("common.tryAgain")}
        </Button>
    </div>
{:else}
    <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-2">
            <SearchField
                label={$_("modsCommunity.searchCommunityMods")}
                bind:value={query}
                width="260px"
            />
            <div
                class="flex flex-wrap items-center gap-1"
                role="group"
                aria-label={$_("modsCommunity.filterGroupLabel")}
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
                >{$_("modsCommunity.shownOfAll", {
                    values: { shown: shown.length, all: all.length },
                })}</span
            >
        </div>

        {#if failed.length}
            <p class="m-0 text-[13px] text-accent">
                {$_("modsCommunity.failedToLoad", {
                    values: {
                        libraries: failed
                            .map((s) => sourceNames[s])
                            .join(" and "),
                    },
                })}
                <button
                    type="button"
                    class="cursor-pointer border-0 bg-transparent p-0 text-accent underline"
                    onclick={() => load(true)}>{$_("common.tryAgain")}</button
                >
            </p>
        {/if}

        {#if shown.length === 0}
            <p class="m-0 bg-row px-[18px] py-8 text-sm text-muted">
                {$_("modsCommunity.emptyNoMatch")}
            </p>
        {:else}
            <ul
                class="m-0 grid list-none gap-2 p-0"
                style="grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));"
            >
                {#each shown as mod (mod.id)}
                    {@const state = installs[mod.id]}
                    <li class="flex flex-col bg-row">
                        <div
                            class="relative aspect-video overflow-hidden bg-tonal"
                            style:background-image={mod.gradient}
                        >
                            {#if mod.thumbnail}
                                <img
                                    src={mod.thumbnail}
                                    alt=""
                                    loading="lazy"
                                    class="size-full object-cover"
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
                                    ? $_("modsCommunity.byAuthor", {
                                          values: { author: mod.author },
                                      })
                                    : $_("modsCommunity.unknownAuthor")}
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
                                    ? $_('modsCommunity.installedAriaLabel')
                                    : $_(
                                          'modsCommunity.installAriaLabel',
                                      )} {mod.name}"
                                onclick={() => installCommunityMod(mod)}
                            >
                                {#if state === "installing"}
                                    {$_("modsCommunity.installing")}
                                {:else if state === "installed"}
                                    <Check
                                        size={16}
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                    />
                                    {$_("modsCommunity.installed")}
                                {:else if state === "failed"}
                                    <RotateCw
                                        size={16}
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                    />
                                    {$_("modsCommunity.retryInstall")}
                                {:else}
                                    <Download
                                        size={16}
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                    />
                                    {$_("modsCommunity.install")}
                                {/if}
                            </Button>
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
{/if}
