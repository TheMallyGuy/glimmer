<script lang="ts">
  import { Plug } from "@lucide/svelte";
  import { Button } from "$lib";
  import { useIntlayer } from "svelte-intlayer";
  import Step from "../../Step.svelte";
  import NextFooter from "../NextFooter.svelte";
  import StatusRow from "../StatusRow.svelte";
  import { isMet, onboarding, shizuku } from "../onboarding.svelte";

  const t = useIntlayer("onboarding");
  const running = $derived(isMet(1, onboarding.setup));
</script>

<Step icon={Plug} title={$t.shizukuTitle.value} blurb={$t.shizukuBlurb.value}>
  <ol class="m-0 flex list-none flex-col gap-0.5 p-0">
    {#each [$t.shizukuStep1.value, $t.shizukuStep2.value, $t.shizukuStep3.value] as line, i (i)}
      <li class="flex items-start gap-4 bg-row px-[18px] py-4">
        <span class="font-display text-lg leading-6 text-muted">{i + 1}</span>
        <span class="text-[13px] leading-6 text-fg-2">{line}</span>
      </li>
    {/each}
  </ol>
  <div class="flex flex-col gap-0.5">
    <StatusRow
      label={$t.shizukuStatus.value}
      value={running ? $t.running.value : $t.notRunning.value}
      ok={running}
    />
    <Button class="mt-2" onclick={() => shizuku.openShizuku()}>{$t.openShizuku.value}</Button>
  </div>

  {#snippet footer()}
    <NextFooter step={1} />
  {/snippet}
</Step>
