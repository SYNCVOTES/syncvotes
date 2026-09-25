<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The head of a page about one thing: a DAO, a proposal, a person. Its face, what it is
	 * called in the user's own words (sentence case, not the app's shouting), one mono line of
	 * facts, its tags, and what can be done with it.
	 */
	let {
		title,
		eyebrow,
		media,
		above,
		meta,
		tags,
		action,
		children
	}: {
		title: string;
		eyebrow?: string;
		media?: Snippet;
		/** A line over the title, such as a status. */
		above?: Snippet;
		meta?: Snippet;
		tags?: Snippet;
		action?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<header class="mb-8">
	<div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
		<div class="flex min-w-0 flex-1 basis-[22rem] items-start gap-4">
			{@render media?.()}
			<div class="min-w-0 flex-1">
				{#if eyebrow}<p class="eyebrow mb-2">{eyebrow}</p>{/if}
				{@render above?.()}
				<h1 class="title text-2xl md:text-title">{title}</h1>
				{#if tags}<div class="mt-3 flex flex-wrap items-center gap-2">{@render tags()}</div>{/if}
				{#if meta}
					<div
						class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-ink-dim"
					>
						{@render meta()}
					</div>
				{/if}
			</div>
		</div>
		{#if action}<div class="flex shrink-0 items-center gap-2">{@render action()}</div>{/if}
	</div>
	{@render children?.()}
</header>
