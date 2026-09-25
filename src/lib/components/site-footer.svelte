<script lang="ts">
	import Brand from './brand.svelte';
	import ThemeToggle from './theme-toggle.svelte';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';

	/** The app's footer: brand, a row of links, the small print; the theme switch on phones. */
	let {
		links,
		github,
		x
	}: {
		links: { href: string; label: string; external?: boolean }[];
		github: string;
		x: string;
	} = $props();
</script>

<footer class="border-t border-border bg-[rgba(var(--bg-rgb),0.95)] px-6 py-6 md:px-10 md:py-8">
	<div class="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-10 gap-y-4">
		<div>
			<Brand beta={false} size="sm" />
			<p class="mt-1.5 font-mono text-xs text-ink-dim">
				On-chain governance for the Canton Network
			</p>
		</div>
		<nav
			class="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-ink-mid"
			aria-label="Footer"
		>
			{#each links as link (link.href)}
				{#if link.external}
					<a
						href={link.href}
						target="_blank"
						rel="noopener"
						class="inline-flex items-center gap-0.5 hover:text-orange"
						>{link.label}<ArrowUpRight size={11} aria-hidden="true" /></a
					>
				{:else}
					<a href={link.href} class="hover:text-orange">{link.label}</a>
				{/if}
			{/each}
			<a href={github} target="_blank" rel="noopener" aria-label="GitHub" class="hover:text-ink">
				<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
					<path
						d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
					/>
				</svg>
			</a>
			<a href={x} target="_blank" rel="noopener" aria-label="X" class="hover:text-ink">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path
						d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z"
					/>
				</svg>
			</a>
			<span class="md:hidden"><ThemeToggle /></span>
		</nav>
	</div>
	<div
		class="mx-auto mt-4 flex max-w-[1120px] flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-dim"
	>
		<span>© {new Date().getFullYear()} SyncVotes</span>
		<span>Built on the Canton Network</span>
	</div>
</footer>
