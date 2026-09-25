<script lang="ts">
	import type { Snippet } from 'svelte';

	/** An app page's title: eyebrow, the uppercase title, at most one line under it, an action. */
	let {
		eyebrow,
		title,
		description,
		action
	}: { eyebrow: string; title: string; description?: string; action?: Snippet } = $props();
</script>

<div class="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-10 md:gap-6">
	<div class="max-w-[540px] min-w-0">
		<div class="eyebrow mb-3 md:mb-4">// {eyebrow}</div>
		<h1 class="display text-4xl md:text-5xl">{title}</h1>
		{#if description}<p class="mt-3 text-sm leading-relaxed text-ink-mid md:mt-4">
				{description}
			</p>{/if}
	</div>
	{#if action}<div class="shrink-0">{@render action()}</div>{/if}
</div>
