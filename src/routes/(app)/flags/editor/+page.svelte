<script lang="ts">
  import { FlagTable } from "$lib";
  import { appState } from "$lib/appState.svelte";
</script>

<FlagTable bind:flags={appState.fastflags.flags} />
