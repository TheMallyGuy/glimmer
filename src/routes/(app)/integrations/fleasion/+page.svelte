<script lang="ts">
    import { goto } from "$app/navigation";
    import { appState } from "$lib/appState.svelte";
    import Button from "$lib/components/Button.svelte";
    import RichText from "$lib/components/RichText.svelte";
    import SettingGroup from "$lib/components/SettingGroup.svelte";
    import SettingRow from "$lib/components/SettingRow.svelte";
    import TextField from "$lib/components/TextField.svelte";
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
    <RichText text={`[danger]${$fleasionContent.fleasionWarn}`} />
</div>

<div class="h-7"></div>

<SettingGroup label="General">
    <SettingRow
        title={$fleasionContent.enableFleasion}
        description={$fleasionContent.enableFleasionDescription}
    >
        {#snippet control()}
            <Switch
                label={$fleasionContent.enableFleasion}
                bind:checked={appState.integrations.fleasion.enabled}
            />
        {/snippet}
    </SettingRow>

    <SettingRow title={$fleasionContent.multiInstance}>
        {#snippet control()}
            <Switch
                label=""
                bind:checked={
                    appState.integrations.fleasion.settings.multiInstance
                }
            />
        {/snippet}
    </SettingRow>
</SettingGroup>

<div class="h-7"></div>

<SettingGroup label="Fast-flags">
    <SettingRow
        title={$fleasionContent.mirrorFastFlags}
        description={$fleasionContent.mirrorFastFlagsDescription}
    >
        {#snippet control()}
            <Switch
                label=""
                bind:checked={
                    appState.integrations.fleasion.settings.mirrorGlimmerFF
                }
                disabled={!appState.integrations.fleasion.enabled}
            />
        {/snippet}
    </SettingRow>

    <SettingRow
        title={$fleasionContent.deVngPreset}
        description={$fleasionContent.deVngPresetDescription}
    >
        {#snippet control()}
            <Switch
                label=""
                bind:checked={appState.integrations.fleasion.settings.deVng}
                disabled={!appState.integrations.fleasion.enabled}
            />
        {/snippet}
    </SettingRow>
</SettingGroup>

<div class="h-7"></div>

<SettingGroup label={$fleasionContent.clientSidedGroup}>
    <SettingRow
        title={$fleasionContent.verifySelf}
        description={$fleasionContent.verifySelfDescription}
    >
        {#snippet control()}
            <Switch
                label=""
                bind:checked={appState.integrations.fleasion.settings.verify}
                disabled={!appState.integrations.fleasion.enabled}
            />
        {/snippet}
    </SettingRow>
    <SettingRow
        title={$fleasionContent.gameCreator}
        description={$fleasionContent.gameCreatorDescription}
    >
        {#snippet control()}
            <Switch
                label=""
                bind:checked={
                    appState.integrations.fleasion.settings.gameCreator
                }
                disabled={!appState.integrations.fleasion.enabled}
            />
        {/snippet}
    </SettingRow>
</SettingGroup>

<TextField
    class="mt-0.5 bg-row px-[18px] py-4"
    label={$fleasionContent.spoofName.value}
    hint={$fleasionContent.spoofNameHint.value}
    placeholder={$fleasionContent.spoofNamePlaceholder.value}
    bind:value={appState.integrations.fleasion.settings.name}
/>
