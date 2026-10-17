<script lang="ts">
  import { CircleCheck } from "@lucide/svelte";
  import { Button } from "$lib";
  import { useIntlayer } from "svelte-intlayer";
  import Step from "../../Step.svelte";
  import { leave } from "../tour";

  const t = useIntlayer("tour");
</script>

<Step class="px-8" icon={CircleCheck} title={$t.doneTitle.value} blurb={$t.doneBlurb.value} done>
  {#snippet footer()}
    <span class="grow"></span>
    <Button variant="primary" arrow onclick={leave}>{$t.finish.value}</Button>
  {/snippet}
</Step>
