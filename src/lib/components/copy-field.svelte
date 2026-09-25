<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';
	import Hint from './hint.svelte';

	/** A value meant to be copied whole — a party id, a memo — with its label and a copy button. */
	let { label, value, hint }: { label: string; value: string; hint?: string } = $props();
	let copied = $state(false);
	async function copy() {
		await navigator.clipboard.writeText(value);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="space-y-1">
	<div
		class="flex items-center gap-1.5 font-mono text-label tracking-[0.14em] text-ink-dim uppercase"
	>
		{label}{#if hint}<Hint text={hint} />{/if}
	</div>
	<div class="flex items-start gap-2 border border-border bg-surface-hover px-3 py-2">
		<code class="min-w-0 flex-1 font-mono text-xs leading-relaxed break-all text-ink">{value}</code>
		<button
			type="button"
			class="shrink-0 text-ink-dim transition-colors hover:text-orange"
			onclick={copy}
			aria-label="Copy {label}"
			title={copied ? 'Copied' : 'Copy'}
		>
			{#if copied}<Check size={14} class="text-green" />{:else}<Copy size={14} />{/if}
		</button>
	</div>
</div>
