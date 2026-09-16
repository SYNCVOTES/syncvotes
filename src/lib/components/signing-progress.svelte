<script lang="ts">
	import Loader from '@lucide/svelte/icons/loader';

	/** Several transactions are being prepared, checked and signed in turn; say where we are. */
	let { done, total, what }: { done: number; total: number; what: string } = $props();
</script>

{#if total > 0 && done < total}
	<div
		class="flex items-center gap-3 border border-border bg-surface px-4 py-3 font-mono text-xs text-ink-mid"
	>
		<Loader size={14} class="animate-spin text-orange" aria-hidden="true" />
		<span>{what} — signing {Math.min(done + 1, total)} of {total}</span>
		<div class="ml-auto h-1 w-32 overflow-hidden bg-surface-active">
			<div class="h-full bg-orange transition-all" style="width: {(done / total) * 100}%"></div>
		</div>
	</div>
{/if}
