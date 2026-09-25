<script lang="ts">
	import { NETWORK } from '$app/env/public';
	import BrandMark from '$lib/components/brand-mark.svelte';

	/**
	 * Mark and wordmark, as one link home. On MainNet it carries the beta tag; elsewhere the
	 * network pill beside it is the one environment signal, so there is no second tag.
	 */
	let { beta = true, size = 'md' }: { beta?: boolean; size?: 'md' | 'sm' } = $props();
	const mainnet = NETWORK.toLowerCase() === 'mainnet';
</script>

<a
	href="/"
	class="flex shrink-0 items-center gap-2.5 font-display font-bold tracking-[0.14em] {size === 'sm'
		? 'gap-2 text-base'
		: 'text-[15px]'}"
>
	<BrandMark size={16} />
	<span>SYNCVOTES</span>
	{#if beta && mainnet}
		<span
			class="border border-amber/30 bg-amber/[0.07] px-1.5 py-0.5 font-mono text-label leading-none font-semibold tracking-[0.08em] text-amber uppercase"
		>
			beta
		</span>
	{/if}
</a>
