<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		eyebrow,
		title,
		description,
		action
	}: { eyebrow: string; title: string; description?: string; action?: Snippet } = $props();
</script>

<div class="mb-10 flex flex-wrap items-end justify-between gap-6">
	<div class="max-w-[540px]">
		<div class="eyebrow mb-4">// {eyebrow}</div>
		<h1 class="display text-4xl md:text-5xl">{title}</h1>
		{#if description}<p class="mt-4 text-sm leading-relaxed text-ink-mid">{description}</p>{/if}
	</div>
	{#if action}<div class="shrink-0">{@render action()}</div>{/if}
</div>
