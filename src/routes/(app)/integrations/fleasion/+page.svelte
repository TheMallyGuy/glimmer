<script lang="ts">
    import { goto } from "$app/navigation";
    import { appState } from "$lib/appState.svelte";
    import Button from "$lib/components/Button.svelte";
    import RichText from "$lib/components/RichText.svelte";
    import SettingGroup from "$lib/components/SettingGroup.svelte";
    import SettingRow from "$lib/components/SettingRow.svelte";
    import Switch from "$lib/components/Switch.svelte";
    import { ArrowLeft } from "@lucide/svelte";
    import { useIntlayer } from "svelte-intlayer";

    const fleasionContent = useIntlayer("fleasion");
</script>

<Button
    variant="ghost"
    size="sm"
    class="-ml-2 mb-5"
    onclick={() => goto("/integrations")}
>
    <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
    {$fleasionContent.backToIntegrations.value}
</Button>

<div class="h-7"></div>

<div class="flex flex-col gap-0.5">
    <RichText
        text="[danger]Please notice that using Fleasion is BANNABLE. Using this can put your account at risk. We're adding this option for our use cases (lol). "
    />
</div>

<div class="h-7"></div>

<SettingGroup label="General">
    <SettingRow title="Enable" description="remember folks: this is bannable">
        {#snippet control()}
            <Switch
                label=""
                bind:checked={appState.integrations.fleasion.enabled}
            />
        {/snippet}
    </SettingRow>
</SettingGroup>

<div class="h-7"></div>

<SettingGroup label="Fast-flags">
    <SettingRow
        title="Mirror Glimmer's fast-flags to Fleasion"
        description="Easier to use i guess"
    >
        {#snippet control()}
            <Switch
                label=""
                bind:checked={
                    appState.integrations.fleasion.settings.mirrorGlimmerFF
                }
            />
        {/snippet}
    </SettingRow>
</SettingGroup>

<div class="h-7"></div>

<SettingGroup label="Client sided modification">
    <SettingRow
        title="I'm verified!"
        description="Verifies yourself. Only you can see it"
    >
        {#snippet control()}
            <Switch
                label=""
                bind:checked={
                    appState.integrations.fleasion.settings.verify
                }
            />
        {/snippet}
    </SettingRow>
    <SettingRow
        title="I'm the game creator!"
        description="Makes you the game creator. Only you can see it"
    >
        {#snippet control()}
            <Switch
                label=""
                bind:checked={
                    appState.integrations.fleasion.settings.gameCreator
                }
            />
        {/snippet}
    </SettingRow>
</SettingGroup>
