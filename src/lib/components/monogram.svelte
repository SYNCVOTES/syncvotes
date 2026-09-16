<script lang="ts">
	/** The first letters of a name in a square, as a stand-in for a picture. */
	let { name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' } = $props();

	const sizes = {
		sm: 'size-[46px] font-mono text-xs tracking-[0.08em]',
		lg: 'size-20 font-display text-2xl font-extrabold'
	};
</script>

<div
	class="flex shrink-0 items-center justify-center border border-orange/30 bg-orange-dim font-bold text-orange {sizes[
		size
	]}"
>
	{name.slice(0, size === 'lg' ? 2 : 3).toUpperCase()}
</div>
