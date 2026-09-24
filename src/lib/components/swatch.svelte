<script lang="ts">
	/** A colour of the palette: the sample, its hex and what it is for. A click copies the hex. */
	let { name, hex, usage }: { name: string; hex: string; usage: string } = $props();
	let copied = $state(false);
	async function copy() {
		await navigator.clipboard.writeText(hex);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<button
	type="button"
	class="border border-border bg-surface text-left transition-colors hover:border-border-hover"
	onclick={copy}
	title={copied ? 'Copied' : `Copy ${hex}`}
	aria-label="Copy {name} {hex}"
>
	<div class="relative h-16 border-b border-border" style="background: {hex}">
		{#if copied}
			<div
				class="absolute inset-0 flex items-center justify-center bg-black/50 font-mono text-xs font-semibold text-[#ede8dc]"
			>
				Copied
			</div>
		{/if}
	</div>
	<div class="p-3.5">
		<div class="font-mono text-[13px] font-semibold text-ink">{hex}</div>
		<div class="mt-0.5 font-display text-[13px] font-semibold text-ink-mid">{name}</div>
		<div class="mt-1 text-xs leading-snug text-ink-dim">{usage}</div>
	</div>
</button>
