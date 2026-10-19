<script lang="ts">
    import type { HTMLInputAttributes } from "svelte/elements";
    import { cn } from "../utils";
    import RichText from "./RichText.svelte";

    interface Props extends Omit<HTMLInputAttributes, "value"> {
        value?: string;
        label: string;
        /** Shown in red under the field; also marks the input invalid. */
        error?: string;
        hint?: string;
        /** Bind to focus the input from outside. */
        ref?: HTMLInputElement;
    }

    let {
        value = $bindable(""),
        ref = $bindable(),
        label,
        error,
        hint,
        class: className = "",
        ...rest
    }: Props = $props();

    const uid = $props.id();
</script>

<div class={cn("flex flex-col gap-1.5", className)}>
    <label for="{uid}-input" class="text-[13px] text-muted">{label}</label>
    <input
        bind:this={ref}
        bind:value
        id="{uid}-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${uid}-msg` : undefined}
        class={cn(
            "h-10 w-full rounded-gl border-0 bg-field px-3.5 text-sm text-fg placeholder:text-subtle",
            "focus:outline-2 focus:outline-offset-2 focus:outline-accent",
            error && "outline-2 outline-offset-2 outline-danger",
        )}
        {...rest}
    />
    {#if error}
        <p id="{uid}-msg" class="m-0 animate-shake text-[13px] text-danger"><RichText text={error} /></p>
    {:else if hint}
        <p id="{uid}-msg" class="m-0 text-[13px] text-muted"><RichText text={hint} /></p>
    {/if}
</div>
