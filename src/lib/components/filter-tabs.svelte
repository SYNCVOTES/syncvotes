<script lang="ts" generics="T">
	/**
	 * A row of filters over one list: the one in force is lit, and each may carry a count so the
	 * row says how much is behind it.
	 */
	let {
		options,
		value = $bindable(),
		label,
		onchange
	}: {
		options: readonly { value: T; label: string; count?: number }[];
		value: T;
		/** What the row filters, for screen readers. */
		label: string;
		onchange?: (value: T) => void;
	} = $props();
</script>

<div class="flex flex-wrap gap-1" role="group" aria-label={label}>
	{#each options as o (o.label)}
		<button
			type="button"
			aria-pressed={value === o.value}
			class="rounded-full px-3 py-1 font-mono text-label tracking-[0.14em] uppercase transition-colors {value ===
			o.value
				? 'bg-orange-dim text-orange'
				: 'text-ink-dim hover:text-ink'}"
			onclick={() => {
				value = o.value;
				onchange?.(o.value);
			}}
			>{o.label}{#if o.count !== undefined}<span
					class="ml-1.5 {value === o.value ? 'text-orange/80' : 'text-ink-dim'}">{o.count}</span
				>{/if}</button
		>
	{/each}
</div>
