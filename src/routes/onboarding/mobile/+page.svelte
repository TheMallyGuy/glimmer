<script lang="ts">
  import { goto } from "$app/navigation";
  import { Hand } from "@lucide/svelte";
  import { Button } from "$lib";
  import { firstUnmetStep } from "$ts/glimmer/android/setup";
  import { useIntlayer } from "svelte-intlayer";
  import Step from "../Step.svelte";
  import { STEPS, finish, onboarding } from "./onboarding.svelte";

  const t = useIntlayer("onboarding");
</script>

<Step icon={Hand} title={$t.welcomeTitle.value} blurb={$t.welcomeBlurb.value}>
  {#snippet footer()}
    <Button variant="ghost" onclick={finish}>{$t.skip.value}</Button>
    <span class="grow"></span>
    <Button
      variant="primary"
      arrow
      onclick={() => goto(STEPS[onboarding.setup ? firstUnmetStep(onboarding.setup) : 1])}
    >
      {$t.getStarted.value}
    </Button>
  {/snippet}
</Step>
