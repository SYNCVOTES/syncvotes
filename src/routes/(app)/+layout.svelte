<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import { Button } from '$lib/components/ui/button';
	import { store } from '$lib/wallet-store.svelte';
	import { theme, toggleTheme } from '$lib/theme.svelte';
	import { NETWORK } from '$lib/network';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';

	let { children } = $props();

	// A problem belongs to the page it happened on.
	afterNavigate(() => (store.problem = null));

	const nav = [
		{ href: '/my-daos', label: 'My DAOs' },
		{ href: '/wallet', label: 'Wallet' }
	];

	const active = (href: string) => page.url.pathname.startsWith(href);

	const GITHUB = 'https://github.com/SYNCVOTES/syncvotes';
	const X = 'https://x.com/syncvotes';
	const links = [
		{ href: GITHUB, label: 'GitHub' },
		{ href: X, label: 'X' },
		{ href: 'https://docs.canton.network', label: 'Canton docs' }
	];

	const walletLabel = $derived(
		store.who ? store.who.name : store.hasKey ? 'Unlock wallet' : 'Connect wallet'
	);
</script>

<div class="flex min-h-screen flex-col">
	<header
		class="sticky top-0 z-50 flex flex-wrap items-center justify-between border-b border-border bg-[rgba(var(--bg-rgb),0.88)] px-4 backdrop-blur-2xl md:h-[68px] md:px-10"
	>
		<div class="flex h-[60px] items-center gap-10 md:h-auto">
			<a
				href="/"
				class="flex items-center gap-2.5 font-display text-[15px] font-bold tracking-[0.14em]"
			>
				<BrandMark size={16} />
				<span>SYNCVOTES</span>
				<span
					class="hidden border border-orange/30 bg-orange/[0.07] px-1.5 py-0.5 font-mono text-xs leading-none font-semibold tracking-[0.08em] text-orange uppercase sm:inline"
				>
					beta
				</span>
			</a>

			<nav class="hidden items-center gap-1 md:flex">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						class="rounded-full px-4 py-[7px] font-mono text-xs tracking-[0.14em] uppercase transition-colors {active(
							item.href
						)
							? 'bg-orange-dim text-orange'
							: 'text-ink-mid hover:text-ink'}"
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</div>

		<div class="flex items-center gap-2.5">
			<button
				type="button"
				class="flex size-8 items-center justify-center rounded-full border border-border text-ink-mid transition-colors hover:border-orange/40 hover:bg-orange-dim hover:text-orange"
				aria-label={theme.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
				onclick={toggleTheme}
			>
				{#if theme.mode === 'dark'}<Sun size={16} />{:else}<Moon size={16} />{/if}
			</button>

			<!-- The network, as a pill like everything else on this row: one dot, one word. -->
			<span
				class="hidden h-8 items-center gap-2 rounded-full border border-amber/30 bg-amber/5 px-3 font-mono text-[0.6875rem] tracking-[0.14em] text-amber uppercase sm:flex"
			>
				<span class="size-1.5 rounded-full bg-amber"></span>
				{NETWORK}
			</span>

			<Button href="/wallet" variant="accent" size="sm">
				{#if store.who}<span class="size-2 rounded-full bg-green"></span>{/if}
				{walletLabel}
			</Button>
		</div>

		<!-- On phones the nav gets its own row under the brand. -->
		<nav
			class="-mx-4 flex w-[calc(100%+2rem)] items-center gap-1 border-t border-border px-3 py-1.5 md:hidden"
		>
			{#each nav as item (item.href)}
				<a
					href={item.href}
					class="rounded-full px-3 py-1.5 font-mono text-[0.6875rem] tracking-[0.14em] uppercase transition-colors {active(
						item.href
					)
						? 'bg-orange-dim text-orange'
						: 'text-ink-mid hover:text-ink'}"
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="border-t border-border bg-[rgba(var(--bg-rgb),0.95)] px-6 pt-12 pb-6 md:px-10">
		<div class="mx-auto grid max-w-[1120px] gap-8 pb-8 md:grid-cols-3 md:gap-12">
			<div>
				<div class="flex items-center gap-2 font-display text-base font-bold tracking-[0.14em]">
					<BrandMark size={16} />
					<span>SYNCVOTES</span>
				</div>
				<p class="mt-2 font-mono text-xs text-ink-dim">On-chain governance for Canton Network</p>
			</div>
			<div class="flex flex-col gap-1.5 md:items-center">
				<span class="eyebrow mb-1">Navigation</span>
				<a href="/my-daos" class="font-mono text-xs text-ink-mid hover:text-orange">My DAOs</a>
				<a href="/wallet" class="font-mono text-xs text-ink-mid hover:text-orange">Wallet</a>
				<a href="/#feed" class="font-mono text-xs text-ink-mid hover:text-orange">How it works</a>
			</div>
			<div class="flex flex-col gap-1.5 md:items-end">
				<span class="eyebrow mb-1">Community</span>
				{#each links as link (link.href)}
					<a
						href={link.href}
						target="_blank"
						rel="noopener"
						class="inline-flex items-center gap-0.5 font-mono text-xs text-ink-mid hover:text-orange"
						>{link.label}<ArrowUpRight size={12} aria-hidden="true" /></a
					>
				{/each}
			</div>
		</div>
		<div
			class="mx-auto flex max-w-[1120px] items-center justify-between gap-4 border-t border-border pt-5 font-mono text-xs text-ink-dim"
		>
			<span>© {new Date().getFullYear()} SyncVotes</span>
			<span class="flex items-center gap-4">
				<span class="hidden sm:inline">Built on Canton Network</span>
				<a href="/version" class="hover:text-orange">build</a>
				<a href={GITHUB} target="_blank" rel="noopener" aria-label="GitHub" class="hover:text-ink">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
						<path
							d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
						/>
					</svg>
				</a>
				<a href={X} target="_blank" rel="noopener" aria-label="X" class="hover:text-ink">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z"
						/>
					</svg>
				</a>
			</span>
		</div>
	</footer>
</div>
