<script lang="ts">
  import { parseRichText, type RichTag } from '../richText';
  import { cn } from '../utils';

  interface Props {
    /** Text with tags in it, e.g. "Your login [danger]expired[/danger]". Only the tags in `RICH_TAGS` do anything. */
    text: string;
    /** Play the motion of danger (a looping shimmer) and accent (one fade) runs. Reduced motion stops all of it. */
    animate?: boolean;
  }

  let { text, animate = true }: Props = $props();

  const looks: Record<RichTag, string> = {
    danger: 'text-danger',
    accent: 'text-accent',
    muted: 'text-muted',
    mono: 'font-mono',
  };
  const entrances: Partial<Record<RichTag, string>> = {
    danger: 'text-shimmer',
    accent: 'animate-fade-in',
  };
</script>

{#each parseRichText(text) as part}{#if part.tag}<span class={cn(looks[part.tag], animate && entrances[part.tag])}>{part.text}</span>{:else}{part.text}{/if}{/each}
