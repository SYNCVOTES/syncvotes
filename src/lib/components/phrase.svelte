<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';
	import { Button } from '$lib/components/ui/button';

	/**
	 * Twelve words, numbered so they can be written down in order. Hidden until revealed, so
	 * a screen glanced at over a shoulder shows nothing; copied whole with one press.
	 */
	let { words, revealed = $bindable(false) }: { words: string; revealed?: boolean } = $props();
	const list = $derived(words.trim().split(/\s+/));
	let copied = $state(false);
	async function copy() {
		await navigator.clipboard.writeText(words);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="border border-border bg-surface-active">
	<div class="relative">
		<ol
			class="grid grid-cols-2 gap-x-6 gap-y-2 p-5 font-mono text-sm sm:grid-cols-3"
			class:select-all={revealed}
			aria-hidden={!revealed}
			data-phrase={revealed ? words : undefined}
		>
			{#each list as word, i (i)}
				<li class="flex items-baseline gap-2">
					<span class="w-5 shrink-0 text-right text-xs text-ink-dim select-none">{i + 1}</span>
					<span
						class="transition-[filter,opacity] duration-300 {revealed
							? 'text-ink'
							: 'text-ink-mid opacity-70 blur-[6px] select-none'}"
					>
						{revealed ? word : '•'.repeat(Math.max(4, word.length))}
					</span>
				</li>
			{/each}
		</ol>
		{#if !revealed}
			<button
				type="button"
				class="absolute inset-0 flex items-center justify-center gap-2 text-sm text-ink hover:text-orange"
				onclick={() => (revealed = true)}
			>
				<Eye size={16} /> Reveal
			</button>
		{/if}
	</div>
	{#if revealed}
		<div class="flex flex-wrap gap-2 border-t border-border px-3 py-2">
			<Button variant="ghost" size="sm" onclick={() => (revealed = false)}>
				<EyeOff size={14} /> Hide
			</Button>
			<Button variant="ghost" size="sm" onclick={copy} aria-label="Copy the phrase">
				{#if copied}<Check size={14} class="text-green" /> Copied{:else}<Copy size={14} /> Copy{/if}
			</Button>
		</div>
	{/if}
</div>
