<script lang="ts">
  import { SettingGroup, SettingRow } from '$lib';
  import { _ } from 'svelte-i18n';
</script>

<SettingGroup>
  <SettingRow title={$_('about.glimmer')} description={$_('about.version')} />
  <SettingRow title={$_('about.sourceCode')} href="#" />
</SettingGroup>
