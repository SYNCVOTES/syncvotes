<script lang="ts">
	import type { Snippet } from 'svelte';
	import type LockIcon from '@lucide/svelte/icons/lock';

	/**
	 * A state a page can be in rather than a failure: nothing here yet, members only, sign in
	 * first. An icon, a title, one line that points somewhere, and what to do about it.
	 */
	let {
		icon,
		title,
		variant = 'plain',
		children,
		actions
	}: {
		icon?: typeof LockIcon;
		title?: string;
		/** `dashed` stands where a list would be; `plain` has the page to itself. */
		variant?: 'plain' | 'dashed';
		children?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<div
	class="flex flex-col items-center gap-3 text-center {variant === 'dashed'
		? 'border border-dashed border-border px-6 py-10'
		: 'py-14 md:py-20'}"
>
	{#if icon}
		{@const Icon = icon}
		<div
			class="mb-1 flex size-14 items-center justify-center border border-border bg-surface text-ink-dim"
		>
			<Icon size={20} strokeWidth={1.6} aria-hidden="true" />
		</div>
	{/if}
	{#if title}<p class="font-display text-item font-bold">{title}</p>{/if}
	{#if children}
		<div class="max-w-md text-body-sm text-ink-dim">{@render children()}</div>
	{/if}
	{#if actions}
		<div class="mt-2 flex w-full max-w-sm flex-col items-center gap-3">{@render actions()}</div>
	{/if}
</div>
