<script lang="ts">
  import { parseRichText, type RichTag } from '../richText';
  import { cn } from '../utils';

  interface Props {
    /** Text with tags in it, e.g. "Your login [danger]expired[/danger]". Only the tags in `RICH_TAGS` do anything. */
    text: string;
    /** Play the motion of danger (a looping red shimmer), shimmer (the same in grey), aurora (a slow looping drift of colour) and accent (one fade) runs. Reduced motion stops all of it. */
    animate?: boolean;
  }

  let { text, animate = true }: Props = $props();

  const looks: Record<RichTag, string> = {
    danger: 'text-danger',
    shimmer: 'text-fg-3',
    accent: 'text-accent',
    muted: 'text-muted',
    mono: 'font-mono',
    aurora: 'text-fg',
  };
  const entrances: Partial<Record<RichTag, string>> = {
    danger: 'text-shimmer text-shimmer-danger',
    shimmer: 'text-shimmer',
    accent: 'animate-fade-in',
    aurora: 'text-aurora',
  };
</script>

{#each parseRichText(text) as part}{#if part.tag}<span class={cn(looks[part.tag], animate && entrances[part.tag])} data-text={part.tag === 'aurora' ? part.text : undefined}>{part.text}</span>{:else}{part.text}{/if}{/each}
