<script lang="ts">
	import { SECTIONS, PAGES, docHref } from '$lib/docs';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
</script>

<header class="mb-10 max-w-[720px]">
	<p class="eyebrow mb-3">// Documentation</p>
	<h1 class="title text-4xl text-ink md:text-5xl">SyncVotes Docs</h1>
	<p class="mt-4 text-body leading-relaxed text-ink-mid md:text-lg">
		How to create a key, run a DAO and vote on the Canton Network, and what the app can and cannot
		do on your behalf.
	</p>
	{#if PAGES.length > 0}
		<div class="mt-6 flex flex-wrap gap-3 font-mono text-xs tracking-[0.14em] uppercase">
			<a
				href={docHref('quickstart')}
				class="inline-flex items-center gap-1.5 rounded-full bg-orange px-4 py-2 text-background hover:opacity-90"
				>Quickstart <ArrowRight size={12} aria-hidden="true" /></a
			>
			<a
				href={docHref('what-is-syncvotes')}
				class="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-ink hover:border-border-hover"
				>What is SyncVotes</a
			>
		</div>
	{/if}
</header>

<div class="space-y-10">
	{#each SECTIONS as section (section.title)}
		<section>
			<h2 class="eyebrow mb-3">{section.title}</h2>
			<ul class="grid gap-3 sm:grid-cols-2">
				{#each section.pages as p (p.slug)}
					<li>
						<a
							href={docHref(p.slug)}
							class="group block h-full border border-border bg-surface p-4 transition-colors hover:border-border-hover hover:bg-surface-hover"
						>
							<span class="block font-display font-bold text-ink group-hover:text-orange"
								>{p.title}</span
							>
							<span class="mt-1 block text-body-sm leading-relaxed text-ink-mid"
								>{p.description}</span
							>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>
