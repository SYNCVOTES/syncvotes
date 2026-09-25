<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import SiteHeader from '$lib/components/site-header.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import { NAV, FOOTER_LINKS, GITHUB, X } from '$lib/site';
	import { SECTIONS, PAGES, pageAt, neighbours, docHref } from '$lib/docs';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	/**
	 * The documentation: the sections and their pages on the left (a menu on phones), the page
	 * with its title and summary from `$lib/docs`, previous and next at the bottom, and the
	 * page's own headings as "On this page" on the right. The headings are read from the
	 * article once it is on screen, so a page is only its text.
	 */
	let { children } = $props();

	const current = $derived(pageAt(page.url.pathname));
	const around = $derived(current ? neighbours(current.slug) : { previous: null, next: PAGES[0] });

	let menuOpen = $state(false);
	let tocOpen = $state(false);
	let article = $state<HTMLElement | null>(null);
	let toc = $state<{ id: string; text: string; level: number }[]>([]);
	let active = $state('');

	afterNavigate(() => {
		menuOpen = false;
		tocOpen = false;
		toc = [...(article?.querySelectorAll<HTMLElement>('.doc h2[id], .doc h3[id]') ?? [])].map(
			(h) => ({ id: h.id, text: h.textContent?.trim() ?? '', level: h.tagName === 'H3' ? 3 : 2 })
		);
		spy();
	});

	/** The section being read: the last heading that has scrolled past the top of the view. */
	function spy() {
		let found = toc[0]?.id ?? '';
		for (const item of toc) {
			const el = document.getElementById(item.id);
			if (el && el.getBoundingClientRect().top < 240) found = item.id;
		}
		active = found;
	}
	let frame = 0;
	const onScroll = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(spy);
	};
</script>

<svelte:head>
	<title>{current ? `${current.title} — SyncVotes Docs` : 'SyncVotes Docs'}</title>
	<meta
		name="description"
		content={current?.description ??
			'How to use SyncVotes: keys and parties, DAOs, proposals, voting rules and balances.'}
	/>
</svelte:head>

<svelte:window onscroll={onScroll} />

{#snippet pages()}
	{#each SECTIONS as section (section.title)}
		<div class="mb-6">
			<p class="eyebrow mb-2">{section.title}</p>
			<ul class="space-y-0.5 border-l border-border">
				{#each section.pages as p (p.slug)}
					{@const here = current?.slug === p.slug}
					<li>
						<a
							href={docHref(p.slug)}
							aria-current={here ? 'page' : undefined}
							class="-ml-px block border-l py-1 pl-3 text-body-sm transition-colors {here
								? 'border-orange text-orange'
								: 'border-transparent text-ink-mid hover:border-border-hover hover:text-ink'}"
							>{p.title}</a
						>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
{/snippet}

{#snippet outline()}
	<ul class="space-y-1 border-l border-border">
		{#each toc as item (item.id)}
			<li>
				<a
					href="#{item.id}"
					class="-ml-px block border-l py-0.5 text-xs leading-snug transition-colors {item.level ===
					3
						? 'pl-6'
						: 'pl-3'} {active === item.id
						? 'border-orange text-ink'
						: 'border-transparent text-ink-dim hover:text-ink'}"
					onclick={() => (tocOpen = false)}>{item.text}</a
				>
			</li>
		{/each}
	</ul>
{/snippet}

<div class="flex min-h-screen flex-col">
	<SiteHeader nav={NAV} />
	<main class="flex-1">
		<div
			class="mx-auto max-w-[1280px] px-6 md:px-10 lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[210px_minmax(0,1fr)_190px]"
		>
			<!-- Phones: the pages behind a menu. Wider: a sidebar that stays in view. -->
			<nav aria-label="Documentation" class="lg:py-12">
				<details
					class="group/menu -mx-6 border-b border-border px-6 py-3 md:-mx-10 md:px-10 lg:hidden"
					bind:open={menuOpen}
				>
					<summary
						class="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden"
					>
						<span class="min-w-0">
							<span class="eyebrow block">Docs{current ? ` · ${current.section}` : ''}</span>
							<span class="block truncate text-body-sm text-ink"
								>{current?.title ?? 'All pages'}</span
							>
						</span>
						<ChevronDown
							size={16}
							class="shrink-0 text-ink-dim transition-transform group-open/menu:rotate-180"
							aria-hidden="true"
						/>
					</summary>
					<div class="pt-5">{@render pages()}</div>
				</details>
				<div
					class="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
				>
					<a
						href="/docs"
						class="mb-6 block font-mono text-xs tracking-[0.14em] uppercase {current
							? 'text-ink-dim hover:text-ink'
							: 'text-orange'}">Docs home</a
					>
					{@render pages()}
				</div>
			</nav>

			<article bind:this={article} class="min-w-0 py-8 md:py-12">
				{#if current}
					<header class="mb-8 max-w-[720px] md:mb-10">
						<p class="eyebrow mb-3">// {current.section}</p>
						<h1 class="title text-4xl text-ink md:text-5xl">{current.title}</h1>
						<p class="mt-4 text-body leading-relaxed text-ink-mid md:text-lg">
							{current.description}
						</p>
						{#if toc.length > 1}
							<details
								class="group/toc mt-6 border-y border-border py-2.5 xl:hidden"
								bind:open={tocOpen}
							>
								<summary
									class="flex cursor-pointer list-none items-center justify-between font-mono text-xs tracking-[0.14em] text-ink-dim uppercase [&::-webkit-details-marker]:hidden"
								>
									On this page
									<ChevronDown
										size={14}
										class="transition-transform group-open/toc:rotate-180"
										aria-hidden="true"
									/>
								</summary>
								<div class="pt-3">{@render outline()}</div>
							</details>
						{/if}
					</header>
				{/if}

				<div class="max-w-[720px] {current ? 'doc' : ''}">
					{@render children()}
				</div>

				<nav
					aria-label="Previous and next"
					class="mt-14 grid max-w-[720px] gap-3 border-t border-border pt-6 sm:grid-cols-2"
				>
					{#if around.previous}
						<a
							href={docHref(around.previous.slug)}
							class="group border border-border p-4 transition-colors hover:border-border-hover hover:bg-surface-hover"
						>
							<span
								class="flex items-center gap-1.5 font-mono text-label tracking-[0.14em] text-ink-dim uppercase"
								><ArrowLeft size={12} aria-hidden="true" /> Previous</span
							>
							<span class="mt-1 block font-display font-bold text-ink group-hover:text-orange"
								>{around.previous.title}</span
							>
						</a>
					{:else}
						<span class="hidden sm:block"></span>
					{/if}
					{#if around.next}
						<a
							href={docHref(around.next.slug)}
							class="group border border-border p-4 text-right transition-colors hover:border-border-hover hover:bg-surface-hover"
						>
							<span
								class="flex items-center justify-end gap-1.5 font-mono text-label tracking-[0.14em] text-ink-dim uppercase"
								>Next <ArrowRight size={12} aria-hidden="true" /></span
							>
							<span class="mt-1 block font-display font-bold text-ink group-hover:text-orange"
								>{around.next.title}</span
							>
						</a>
					{/if}
				</nav>
			</article>

			<aside aria-label="On this page" class="hidden py-12 xl:block">
				{#if toc.length > 1}
					<div class="sticky top-24">
						<p class="eyebrow mb-3">On this page</p>
						{@render outline()}
					</div>
				{/if}
			</aside>
		</div>
	</main>
	<SiteFooter links={FOOTER_LINKS} github={GITHUB} x={X} />
</div>
