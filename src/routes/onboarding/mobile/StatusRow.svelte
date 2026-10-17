<script lang="ts">
  import { cn } from "$lib";

  /** where one part of the setup stands: the value turns accent once it is done */
  let { label, value, ok }: { label: string; value: string; ok: boolean } = $props();
</script>

<div class="flex items-center justify-between gap-4 bg-row px-[18px] py-4">
  <span class="text-[15px] font-medium">{label}</span>
  <span class={cn("text-[13px]", ok ? "text-accent" : "text-muted")}>{value}</span>
</div>
