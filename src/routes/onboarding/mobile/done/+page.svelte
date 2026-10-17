<script lang="ts">
  import { CircleCheck } from "@lucide/svelte";
  import { Button } from "$lib";
  import { useIntlayer } from "svelte-intlayer";
  import Step from "../../Step.svelte";
  import { finish } from "../onboarding.svelte";

  const t = useIntlayer("onboarding");
</script>

<Step icon={CircleCheck} title={$t.doneTitle.value} blurb={$t.doneBlurb.value} done>
  {#snippet footer()}
    <span class="grow"></span>
    <Button variant="primary" arrow onclick={finish}>{$t.continue.value}</Button>
  {/snippet}
</Step>
