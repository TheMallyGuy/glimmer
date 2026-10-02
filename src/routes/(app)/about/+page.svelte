<script lang="ts">
  import { SettingGroup, SettingRow } from '$lib';
  import { useIntlayer } from "svelte-intlayer";
  const aboutContent = useIntlayer("about");
</script>

<SettingGroup>
  <SettingRow title={$aboutContent.glimmer.value} description={$aboutContent.version.value} />
  <SettingRow title={$aboutContent.sourceCode.value} href="#" />
</SettingGroup>
