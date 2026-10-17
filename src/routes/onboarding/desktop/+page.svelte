<script lang="ts">
  import { goto } from "$app/navigation";
  import { Hand } from "@lucide/svelte";
  import { Button } from "$lib";
  import { useIntlayer } from "svelte-intlayer";
  import Step from "../Step.svelte";
  import { STEPS, leave } from "./tour";

  const t = useIntlayer("tour");
</script>

<Step class="px-8" icon={Hand} title={$t.welcomeTitle.value} blurb={$t.welcomeBlurb.value}>
  {#snippet footer()}
    <Button variant="ghost" onclick={leave}>{$t.skip.value}</Button>
    <span class="grow"></span>
    <Button variant="primary" arrow onclick={() => goto(STEPS[1])}>{$t.getStarted.value}</Button>
  {/snippet}
</Step>
