<script lang="ts">
  import type { Component, Snippet } from "svelte";
  import { cn } from "$lib";

  interface Props {
    icon: Component<any>;
    title: string;
    blurb: string;
    /** the last step: its icon is drawn in the accent */
    done?: boolean;
    class?: string;
    children?: Snippet;
    /** the buttons at the bottom: Skip or Back on the left, the main action on the right */
    footer: Snippet;
  }

  let { icon: Icon, title, blurb, done = false, class: className, children, footer }: Props = $props();
</script>

<main class={cn("flex min-h-0 grow flex-col justify-center overflow-auto px-5 py-6", className)}>
  <div class="flex animate-fade-up flex-col gap-6">
    <div class="flex flex-col gap-4">
      <div class="flex size-14 items-center justify-center rounded-gl bg-row">
        <Icon size={28} strokeWidth={1.75} aria-hidden="true" class={done ? "text-accent" : "text-muted"} />
      </div>
      <div class="flex flex-col gap-1.5">
        <h1 class="m-0 font-display text-[32px] font-normal tracking-[0.01em]">{title}</h1>
        <p class="m-0 max-w-[520px] text-sm text-muted">{blurb}</p>
      </div>
    </div>
    {@render children?.()}
  </div>
</main>

<footer class="flex h-16 shrink-0 items-center gap-1 bg-footer px-5">
  {@render footer()}
</footer>
