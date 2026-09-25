<script lang="ts">
  import { tick } from 'svelte';
  import { Plus, Upload, Trash2 } from '@lucide/svelte';
  import Button from './Button.svelte';
  import IconButton from './IconButton.svelte';
  import SearchField from './SearchField.svelte';
  import Dialog from './Dialog.svelte';
  import { flagType, newFlag, parseFlagsJson, flagsToObject, type Flag } from '../flags';
  import { cn } from '../utils';

  interface Props {
    /** Pass a $state array and bind it: `bind:flags`. */
    flags?: Flag[];
    /** File name used by Export JSON. */
    exportName?: string;
    class?: string;
    onchange?: (flags: Flag[]) => void;
  }

  let { flags = $bindable([]), exportName = 'fastflags.json', class: className = '', onchange }: Props = $props();

  let query = $state('');
  let error = $state('');
  let confirmReset = $state(false);
  let fileInput: HTMLInputElement;
  let nameInputs: Record<string, HTMLInputElement> = {};
  let justAdded = $state<string | null>(null);

  const grid = 'grid grid-cols-[minmax(0,1fr)_200px_110px_44px] items-center gap-x-3';
  const cell =
    'h-9 w-full rounded-gl border-0 bg-transparent px-2 font-mono text-[13px] text-fg placeholder:text-subtle hover:bg-hover focus:bg-tonal focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent';

  const counts = $derived.by(() => {
    const c = new Map<string, number>();
    for (const f of flags) {
      const k = f.name.trim();
      if (k) c.set(k, (c.get(k) ?? 0) + 1);
    }
    return c;
  });

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flags;
    return flags.filter((f) => f.id === justAdded || f.name.toLowerCase().includes(q) || f.value.toLowerCase().includes(q));
  });

  function typeLabel(f: Flag) {
    if ((counts.get(f.name.trim()) ?? 0) > 1) return { text: 'Duplicate', bad: true };
    const t = flagType(f.name);
    return t === 'Empty' ? { text: '—', bad: false } : { text: t, bad: t === 'Unknown prefix' };
  }

  function changed() {
    onchange?.(flags);
  }

  async function add() {
    const f = newFlag();
    flags.push(f);
    justAdded = f.id;
    changed();
    await tick();
    nameInputs[f.id]?.focus();
  }

  function remove(id: string) {
    const i = flags.findIndex((f) => f.id === id);
    if (i >= 0) flags.splice(i, 1);
    changed();
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const incoming = parseFlagsJson(await file.text());
      for (const f of incoming) {
        const existing = flags.find((x) => x.name === f.name);
        if (existing) existing.value = f.value;
        else flags.push(f);
      }
      error = '';
      changed();
    } catch (err) {
      error = `Couldn’t import ${file.name}: ${err instanceof Error ? err.message : 'the file isn’t valid JSON.'}`;
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(flagsToObject(flags), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: exportName });
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetAll() {
    flags.length = 0;
    confirmReset = false;
    changed();
  }
</script>

<div class={cn('flex min-h-0 flex-col gap-3', className)}>
  <div class="flex items-center gap-2">
    <SearchField label="Filter flags" bind:value={query} width="300px" />
    <div class="grow"></div>
    <Button variant="secondary" size="sm" class="h-10" onclick={() => fileInput.click()}>
      <Upload size={16} strokeWidth={1.75} aria-hidden="true" /> Import JSON
    </Button>
    <Button variant="primary" size="sm" class="h-10" onclick={add}>
      <Plus size={16} strokeWidth={1.75} aria-hidden="true" /> Add flag
    </Button>
    <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={onFile} />
  </div>

  {#if error}<p class="m-0 text-[13px] text-danger" role="alert">{error}</p>{/if}

  <div class="flex min-h-0 grow flex-col" role="table" aria-label="Fast Flags">
    <div class={cn(grid, 'h-9 pl-[18px] pr-2 text-[13px] text-muted')} role="row">
      <div role="columnheader">Name</div>
      <div role="columnheader" class="pl-2">Value</div>
      <div role="columnheader">Type</div>
      <div role="columnheader"><span class="sr-only">Actions</span></div>
    </div>

    <div class="flex min-h-0 flex-col gap-0.5 overflow-auto" role="rowgroup">
      {#each shown as flag (flag.id)}
        {@const t = typeLabel(flag)}
        <div class={cn(grid, 'h-13 shrink-0 bg-row pl-2.5 pr-2')} role="row">
          <div role="cell">
            <input
              bind:this={nameInputs[flag.id]}
              bind:value={flag.name}
              oninput={changed}
              class={cell}
              aria-label="Flag name"
              placeholder="FFlagName"
              spellcheck="false"
              autocomplete="off"
            />
          </div>
          <div role="cell">
            <input
              bind:value={flag.value}
              oninput={changed}
              class={cell}
              aria-label="Value for {flag.name || 'new flag'}"
              placeholder="Value"
              spellcheck="false"
              autocomplete="off"
            />
          </div>
          <div role="cell" class={cn('text-[13px]', t.bad ? 'text-danger' : 'text-fg-2')}>{t.text}</div>
          <div role="cell">
            <IconButton label="Remove {flag.name || 'flag'}" variant="ghost" size="sm" onclick={() => remove(flag.id)}>
              <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      {:else}
        <div class="bg-row px-[18px] py-8 text-sm text-muted">
          {flags.length === 0 ? 'No flags yet. Add one or import a JSON file.' : 'No flags match that filter.'}
        </div>
      {/each}
    </div>
  </div>

  <div class="flex items-center gap-1 pt-1">
    <span class="grow text-[13px] text-muted">{flags.length} {flags.length === 1 ? 'flag' : 'flags'}</span>
    <Button variant="ghost" size="sm" onclick={exportJson} disabled={flags.length === 0}>Export JSON</Button>
    <Button
      variant="ghost"
      size="sm"
      class="enabled:text-danger hover:enabled:text-danger"
      onclick={() => (confirmReset = true)}
      disabled={flags.length === 0}
    >
      Reset all
    </Button>
  </div>
</div>

<Dialog bind:open={confirmReset} title="Reset all Fast Flags?">
  <p>This removes every flag you have set and restores the client defaults. You can’t undo this.</p>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (confirmReset = false)}>Cancel</Button>
    <Button variant="danger" onclick={resetAll}>Reset flags</Button>
  {/snippet}
</Dialog>
