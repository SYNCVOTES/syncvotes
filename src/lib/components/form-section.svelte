<script lang="ts">
	import type { Snippet } from 'svelte';
	import Panel from './panel.svelte';
	import Hint from './hint.svelte';

	/**
	 * A group of fields with an eyebrow. `plain` is a numbered section under a hairline, for
	 * long forms where every group in a box would be a box too many; `fixed` marks what cannot
	 * be changed after the form is signed.
	 */
	let {
		title,
		number,
		hint,
		fixed = false,
		variant = 'panel',
		children
	}: {
		title?: string;
		number?: string;
		hint?: string;
		fixed?: boolean;
		variant?: 'panel' | 'plain';
		children: Snippet;
	} = $props();
</script>

{#snippet heading()}
	{#if title}
		<h2 class="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
			{#if number}<span class="text-ink-mid">{number}</span><span aria-hidden="true">·</span>{/if}
			<span>{title}</span>
			{#if hint}<Hint text={hint} />{/if}
			{#if fixed}<span class="tracking-[0.12em] text-amber normal-case">can't be changed later</span
				>{/if}
		</h2>
	{/if}
{/snippet}

{#if variant === 'plain'}
	<section class="space-y-5 border-t border-border pt-6">
		{@render heading()}
		{@render children()}
	</section>
{:else}
	<Panel class="space-y-5">
		{@render heading()}
		{@render children()}
	</Panel>
{/if}
