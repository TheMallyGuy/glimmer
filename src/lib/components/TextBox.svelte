<script lang="ts">
    import type { HTMLTextareaAttributes } from "svelte/elements";
    import { cn } from "../utils";
    import RichText from "./RichText.svelte";

    interface Props extends Omit<HTMLTextareaAttributes, "value"> {
        value?: string;
        label: string;
        /** Shown in red under the box; also marks the textarea invalid. */
        error?: string;
        hint?: string;
        /** Geist Mono, for code such as pasted JSON. */
        mono?: boolean;
        /** Bind to focus the textarea from outside. */
        ref?: HTMLTextAreaElement;
    }

    let {
        value = $bindable(""),
        ref = $bindable(),
        label,
        error,
        hint,
        mono = false,
        rows = 6,
        class: className = "",
        ...rest
    }: Props = $props();

    const uid = $props.id();
</script>

<div class={cn("flex flex-col gap-1.5", className)}>
    <label for="{uid}-input" class="text-[13px] text-muted">{label}</label>
    <textarea
        bind:this={ref}
        bind:value
        id="{uid}-input"
        {rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${uid}-msg` : undefined}
        class={cn(
            "w-full resize-y rounded-gl border-0 bg-field p-3.5 text-sm text-fg placeholder:text-subtle",
            mono && "font-mono text-[13px]",
            "focus:outline-2 focus:outline-offset-2 focus:outline-accent",
            error && "outline-2 outline-offset-2 outline-danger",
        )}
        {...rest}
    ></textarea>
    {#if error}
        <p id="{uid}-msg" class="m-0 text-[13px] text-danger" role="alert"><RichText text={error} /></p>
    {:else if hint}
        <p id="{uid}-msg" class="m-0 text-[13px] text-muted"><RichText text={hint} /></p>
    {/if}
</div>
