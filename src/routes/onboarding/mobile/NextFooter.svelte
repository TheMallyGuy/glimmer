<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib";
  import { useIntlayer } from "svelte-intlayer";
  import { STEPS, check, isMet, onboarding } from "./onboarding.svelte";

  /** Back, Check again and Next of the steps that wait for the phone (1 to 3) */
  let { step }: { step: number } = $props();
  const t = useIntlayer("onboarding");
</script>

<Button variant="ghost" onclick={() => goto(STEPS[step - 1])}>{$t.back.value}</Button>
<span class="grow"></span>
<Button variant="ghost" disabled={onboarding.checking} onclick={() => check(step)}>{$t.checkAgain.value}</Button>
<Button variant="primary" arrow disabled={!isMet(step, onboarding.setup)} onclick={() => goto(STEPS[step + 1])}>
  {$t.next.value}
</Button>
