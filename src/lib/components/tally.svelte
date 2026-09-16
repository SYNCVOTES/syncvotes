<script lang="ts">
	import Panel from './panel.svelte';
	import { fmt } from '$lib/format';

	/** Yes against no, out of everyone eligible; what it takes to pass; how many have voted. */
	let {
		yes,
		no,
		total,
		needed,
		cast
	}: { yes: number; no: number; total: number; needed: number; cast: number } = $props();
	const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
</script>

<Panel padding="sm">
	<h2 class="eyebrow mb-4">Tally</h2>
	<div class="mb-2 flex h-2 overflow-hidden bg-surface-active">
		<div class="bg-green" style="width: {pct(yes)}%"></div>
		<div class="bg-red" style="width: {pct(no)}%"></div>
	</div>
	<div class="flex justify-between font-mono text-xs">
		<span class="text-green">{fmt(yes)} yes</span>
		<span class="text-ink-dim">{fmt(needed)} of {fmt(total)} to pass</span>
		<span class="text-red">{fmt(no)} no</span>
	</div>
	<p class="mt-3 font-mono text-xs text-ink-dim">
		{fmt(cast)} of {fmt(total)} voted{cast > yes + no
			? `, ${fmt(cast - yes - no)} being counted`
			: ''}
	</p>
</Panel>
