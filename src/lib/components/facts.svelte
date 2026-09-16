<script lang="ts">
	/** A strip of figures with their labels, divided by hairlines. */
	let { items }: { items: { label: string; value: string; accent?: boolean }[] } = $props();
</script>

<dl class="my-10 grid grid-cols-2 border-y border-border py-6 md:grid-cols-4">
	{#each items as { label, value, accent }, i (label)}
		<div
			class="px-5 {i % 2 === 1 ? 'border-l border-border' : ''} {i >= 2
				? 'md:border-l md:border-border'
				: ''}"
		>
			<dd class="font-mono text-lg font-bold {accent ? 'text-orange' : 'text-ink'}">{value}</dd>
			<dt class="mt-1 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">{label}</dt>
		</div>
	{/each}
</dl>
