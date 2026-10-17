<script>
    import { flagsToObject } from "$lib";
    import { appState } from "$lib/appState.svelte";
    import Button from "$lib/components/Button.svelte";
    import SettingGroup from "$lib/components/SettingGroup.svelte";
    import SettingRow from "$lib/components/SettingRow.svelte";
    import TextBox from "$lib/components/TextBox.svelte";
    import { launchOnAndroid } from "$ts/glimmer/android/launch";

    let launchArgs = $state("");

    function launchRblxWithArgs() {
        launchOnAndroid({
            deeplink: launchArgs,
            flags: appState.fastflags.enabled
                ? flagsToObject(appState.fastflags.flags)
                : null,
        });
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
</SettingGroup>
