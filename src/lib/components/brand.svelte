<script lang="ts">
	import BrandMark from '$lib/components/brand-mark.svelte';

	/** Mark, wordmark and the beta badge, as one link home. */
	let { beta = true, size = 'md' }: { beta?: boolean; size?: 'md' | 'sm' } = $props();
</script>

<a
	href="/"
	class="flex items-center gap-2.5 font-display font-bold tracking-[0.14em] {size === 'sm'
		? 'gap-2 text-base'
		: 'text-[15px]'}"
>
	<BrandMark size={16} />
	<span>SYNCVOTES</span>
	{#if beta}
		<span
			class="hidden border border-orange/30 bg-orange/[0.07] px-1.5 py-0.5 font-mono text-xs leading-none font-semibold tracking-[0.08em] text-orange uppercase sm:inline"
		>
			beta
		</span>
	{/if}
</a>
