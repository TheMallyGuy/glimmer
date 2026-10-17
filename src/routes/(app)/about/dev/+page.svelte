<script lang="ts">
    import { flagsToObject, toast } from "$lib";
    import { appState } from "$lib/appState.svelte";
    import Button from "$lib/components/Button.svelte";
    import SettingGroup from "$lib/components/SettingGroup.svelte";
    import SettingRow from "$lib/components/SettingRow.svelte";
    import TextBox from "$lib/components/TextBox.svelte";
    import { launchOnAndroid } from "$ts/glimmer/android/launch";
    import { isAndroid } from "$ts/glimmer/android/platform";
    import { save } from "$lib/settings.svelte";
    import { goto } from "$app/navigation";

    let launchArgs = $state("");

    function launchRblxWithArgs() {
        launchOnAndroid({
            deeplink: launchArgs,
            flags: appState.fastflags.enabled
                ? flagsToObject(appState.fastflags.flags)
                : null,
        });
    }

    async function resetOnboard() {
        appState.onboarded = false;
        await save();
        toast.success("onboarding shows on the next launch");
    }
</script>

dev page for testing

<!--localization is not recommended for this page-->

<SettingGroup label="roblox app testing [android only]">
    <SettingRow title="launch with args">
        {#snippet control()}
            <div class="flex flex-col gap-0.5">
                <TextBox
                    label="args would be awsome"
                    class="h-25"
                    mono={true}
                    bind:value={launchArgs}
                    placeholder="text"
                />

                <Button variant="primary" onclick={launchRblxWithArgs}>
                    launch
                </Button>
            </div>
        {/snippet}
    </SettingRow>

    <SettingRow title="reset onbroading">
        {#snippet control()}
            <Button variant="primary" onclick={resetOnboard}>click me</Button>
        {/snippet}
    </SettingRow>
</SettingGroup>
