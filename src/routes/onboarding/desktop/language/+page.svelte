<script lang="ts">
  import { goto } from "$app/navigation";
  import { Languages } from "@lucide/svelte";
  import { Button, LanguageDropdown, SettingRow } from "$lib";
  import { useIntlayer } from "svelte-intlayer";
  import Step from "../../Step.svelte";
  import { STEPS } from "../tour";

  const t = useIntlayer("tour");
  const common = useIntlayer("common");
</script>

<Step class="px-8" icon={Languages} title={$t.languageTitle.value} blurb={$t.languageBlurb.value}>
  <div class="flex flex-col gap-0.5">
    <SettingRow title={$common.language.value}>
      {#snippet control()}
        <LanguageDropdown />
      {/snippet}
    </SettingRow>
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => goto(STEPS[0])}>{$t.back.value}</Button>
    <span class="grow"></span>
    <Button variant="primary" arrow onclick={() => goto(STEPS[2])}>{$t.next.value}</Button>
  {/snippet}
</Step>
