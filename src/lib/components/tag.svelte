<script lang="ts">
	import type { Snippet } from 'svelte';
	import type LockIcon from '@lucide/svelte/icons/lock';

	/**
	 * A small pill for a fact about a thing: private, by shares, creator. Neutral unless the
	 * fact asks something of the reader; an icon says what kind of fact it is.
	 */
	let {
		icon,
		tone = 'neutral',
		class: className = '',
		children
	}: {
		icon?: typeof LockIcon;
		tone?: 'neutral' | 'accent' | 'warn' | 'danger' | 'success';
		class?: string;
		children: Snippet;
	} = $props();
	const tones = {
		neutral: 'border-border bg-surface-hover text-ink-mid',
		accent: 'border-orange/40 bg-orange/10 text-orange',
		warn: 'border-amber/40 bg-amber/10 text-amber',
		danger: 'border-red/40 bg-red/10 text-red',
		success: 'border-green/40 bg-green/10 text-green'
	};
</script>

<span
	class="inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-label tracking-[0.12em] whitespace-nowrap uppercase {tones[
		tone
	]} {className}"
>
	{#if icon}
		{@const Icon = icon}
		<Icon size={11} strokeWidth={2.2} aria-hidden="true" />
	{/if}
	{@render children()}
</span>
