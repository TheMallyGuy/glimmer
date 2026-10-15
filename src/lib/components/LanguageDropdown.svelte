<script lang="ts">
  import Dropdown from './Dropdown.svelte';
  import { appState } from '../appState.svelte';
  import { useIntlayer } from 'svelte-intlayer';

  let { width = '200px' }: { width?: string } = $props();

  const commonContent = useIntlayer('common');

  // each language is named in itself, so a person can find theirs whatever Glimmer shows now
  const options = $derived([
    { value: 'en', label: $commonContent.languageEnglish.value },
    { value: 'vi', label: $commonContent.languageVietnamese.value }
  ]);
</script>

<Dropdown label={$commonContent.language.value} {width} {options} bind:value={appState.language} />
