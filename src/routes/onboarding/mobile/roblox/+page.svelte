<script lang="ts">
  import { Gamepad2 } from "@lucide/svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { Button } from "$lib";
  import { ROBLOX_PACKAGE } from "$ts/glimmer/android/setup";
  import { useIntlayer } from "svelte-intlayer";
  import Step from "../../Step.svelte";
  import NextFooter from "../NextFooter.svelte";
  import StatusRow from "../StatusRow.svelte";
  import { onboarding } from "../onboarding.svelte";

  const t = useIntlayer("onboarding");
  const setup = $derived(onboarding.setup);
  const status = $derived(
    setup?.roblox === true
      ? setup.robloxVersion
        ? `${$t.installed.value} · ${$t.robloxVersion({ version: setup.robloxVersion }).value}`
        : $t.installed.value
      : setup?.roblox === false
        ? $t.missing.value
        : $t.unknown.value,
  );
</script>

<Step icon={Gamepad2} title={$t.robloxTitle.value} blurb={$t.robloxBlurb.value}>
  <div class="flex flex-col gap-0.5">
    <StatusRow label={$t.robloxStatus.value} value={status} ok={setup?.roblox === true} />
    {#if setup?.roblox !== true}
      <Button
        class="mt-2"
        onclick={() => openUrl(`https://play.google.com/store/apps/details?id=${ROBLOX_PACKAGE[0]}`)}
      >
        {$t.getRoblox.value}
      </Button>
    {/if}
  </div>

  {#snippet footer()}
    <NextFooter step={3} />
  {/snippet}
</Step>
