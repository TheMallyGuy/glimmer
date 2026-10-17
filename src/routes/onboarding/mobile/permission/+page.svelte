<script lang="ts">
  import { ShieldCheck } from "@lucide/svelte";
  import { Button } from "$lib";
  import { useIntlayer } from "svelte-intlayer";
  import Step from "../../Step.svelte";
  import NextFooter from "../NextFooter.svelte";
  import StatusRow from "../StatusRow.svelte";
  import { allow, isMet, onboarding } from "../onboarding.svelte";

  const t = useIntlayer("onboarding");
  const running = $derived(isMet(1, onboarding.setup));
  const allowed = $derived(isMet(2, onboarding.setup));
</script>

<Step icon={ShieldCheck} title={$t.permissionTitle.value} blurb={$t.permissionBlurb.value}>
  <div class="flex flex-col gap-0.5">
    <StatusRow
      label={$t.permissionStatus.value}
      value={allowed ? $t.allowed.value : running ? $t.waiting.value : $t.needsShizuku.value}
      ok={allowed}
    />
    {#if !allowed}
      <Button class="mt-2" disabled={!running} onclick={() => allow(2)}>{$t.allow.value}</Button>
    {/if}
  </div>

  {#snippet footer()}
    <NextFooter step={2} />
  {/snippet}
</Step>
