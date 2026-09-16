<script lang="ts">
	import Panel from './panel.svelte';

	/** Yes against no, out of everyone, and what it takes to pass. */
	let { yes, no, total, needed }: { yes: number; no: number; total: number; needed: number } =
		$props();
</script>

<Panel padding="sm">
	<h2 class="eyebrow mb-4">Tally</h2>
	<div class="mb-2 flex h-2 overflow-hidden bg-surface-active">
		<div class="bg-green" style="width: {(yes / total) * 100}%"></div>
		<div class="bg-red" style="width: {(no / total) * 100}%"></div>
	</div>
	<div class="flex justify-between font-mono text-xs">
		<span class="text-green">{yes} yes</span>
		<span class="text-ink-dim">{needed} of {total} to pass</span>
		<span class="text-red">{no} no</span>
	</div>
</Panel>
