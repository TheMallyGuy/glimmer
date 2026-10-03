<script lang="ts">
  import { CircleAlert, CircleCheck, Info, X } from '@lucide/svelte';
  import { useIntlayer } from 'svelte-intlayer';
  import { toast, toasts } from '../toasts.svelte';
  import { cn } from '../utils';
  import Button from './Button.svelte';
  import IconButton from './IconButton.svelte';

  const toastContent = useIntlayer('toast');

  const icons = { info: Info, success: CircleCheck, error: CircleAlert };
</script>

<!-- Bottom left, over everything. The region itself never takes a click, so only the toasts do. -->
<section
  aria-label={$toastContent.region.value}
  class="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-0.5"
>
  {#each toasts.items as item (item.id)}
    {@const Icon = icons[item.kind]}
    <!-- errors interrupt a screen reader, everything else waits its turn -->
    <div
      role={item.kind === 'error' ? 'alert' : 'status'}
      class="pointer-events-auto flex items-start gap-3 rounded-gl bg-menu py-3 pr-2 pl-3.5 shadow-menu"
      onpointerenter={() => toast.pause(item.id)}
      onpointerleave={() => toast.resume(item.id)}
      onfocusin={() => toast.pause(item.id)}
      onfocusout={() => toast.resume(item.id)}
    >
      <Icon
        size={18}
        strokeWidth={1.75}
        aria-hidden="true"
        class={cn('mt-px shrink-0', item.kind === 'error' ? 'text-danger' : 'text-muted')}
      />
      <p class="m-0 min-w-0 grow py-0.5 text-sm break-words text-fg">{item.message}</p>
      {#if item.action}
        {@const action = item.action}
        <Button
          variant="ghost"
          size="sm"
          onclick={() => {
            action.run();
            toast.dismiss(item.id);
          }}
        >
          {action.label}
        </Button>
      {/if}
      <IconButton label={$toastContent.dismiss.value} variant="ghost" size="sm" onclick={() => toast.dismiss(item.id)}>
        <X size={16} strokeWidth={1.75} aria-hidden="true" />
      </IconButton>
    </div>
  {/each}
</section>
