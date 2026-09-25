<script lang="ts">
	/** The first letters of a name in a square, as a stand-in for a picture. Neutral. */
	let { name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' } = $props();

	const sizes = {
		sm: 'size-[46px] font-mono text-xs tracking-[0.08em]',
		lg: 'size-14 font-display text-xl font-extrabold'
	};
</script>

<div
	class="flex shrink-0 items-center justify-center border border-border bg-surface-active font-bold text-ink-mid {sizes[
		size
	]}"
>
	{name.slice(0, size === 'lg' ? 2 : 3).toUpperCase()}
</div>
