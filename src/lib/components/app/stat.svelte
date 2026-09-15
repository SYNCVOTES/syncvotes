<script lang="ts">
	let { value, label, sub, accent = false }: { value: string | number; label: string; sub?: string; accent?: boolean } =
		$props();
</script>

<div class="border border-border bg-surface px-5 py-[22px]">
	<div class="mb-1 font-mono text-[26px] font-bold {accent ? 'text-orange' : 'text-ink'}">{value}</div>
	<div class="font-mono text-xs font-bold uppercase tracking-[0.14em] text-ink-mid">{label}</div>
	{#if sub}<div class="mt-0.5 text-xs text-ink-dim">{sub}</div>{/if}
</div>
