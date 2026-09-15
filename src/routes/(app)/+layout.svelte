<script lang="ts">
	import { page } from '$app/state';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import { Button } from '$lib/components/ui/button';
	import { store } from '$lib/wallet-store.svelte';
	import { theme, toggleTheme } from '$lib/theme.svelte';

	let { children } = $props();

	const nav = [
		{ href: '/my-daos', label: 'My DAOs' },
		{ href: '/wallet', label: 'Wallet' }
	];

	const active = (href: string) => page.url.pathname.startsWith(href);

	const walletLabel = $derived(
		store.who ? store.who.name : store.hasKey ? 'Unlock wallet' : 'Connect wallet'
	);
</script>

<div class="flex min-h-screen flex-col">
	<header
		class="sticky top-0 z-50 flex h-[68px] items-center justify-between border-b border-border bg-[rgba(var(--bg-rgb),0.88)] px-4 backdrop-blur-2xl md:px-10"
	>
		<div class="flex items-center gap-10">
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
				{#if theme.mode === 'dark'}
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.8" />
						<path
							d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
						/>
					</svg>
				{:else}
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linejoin="round"
						/>
					</svg>
				{/if}
			</button>

			<!-- The network, as a pill like everything else on this row: one dot, one word. -->
			<span
				class="hidden h-8 items-center gap-2 rounded-full border border-amber/30 bg-amber/5 px-3 font-mono text-[0.6875rem] tracking-[0.14em] text-amber uppercase sm:flex"
			>
				<span class="size-1.5 rounded-full bg-amber"></span>
				TestNet
			</span>

			<Button href="/wallet" variant="accent" size="sm">
				{#if store.who}<span class="size-2 rounded-full bg-green"></span>{/if}
				{walletLabel}
			</Button>
		</div>
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
			<div class="flex flex-col gap-1 md:items-center">
				<span class="eyebrow mb-1">Navigation</span>
				<a href="/my-daos" class="font-mono text-xs text-ink-mid hover:text-orange">My DAOs</a>
				<a href="/wallet" class="font-mono text-xs text-ink-mid hover:text-orange">Wallet</a>
			</div>
			<div class="flex flex-col gap-1 md:items-end">
				<span class="eyebrow mb-1">Network</span>
				<a href="/version" class="font-mono text-xs text-ink-mid hover:text-orange">Build</a>
				<a
					href="https://docs.canton.network"
					target="_blank"
					rel="noopener"
					class="font-mono text-xs text-ink-mid hover:text-orange">Canton docs ↗</a
				>
			</div>
		</div>
		<div
			class="mx-auto flex max-w-[1120px] items-center justify-between border-t border-border pt-5 font-mono text-xs text-ink-dim"
		>
			<span>© {new Date().getFullYear()} SyncVotes</span>
			<span>Built on Canton Network</span>
		</div>
	</footer>
</div>
