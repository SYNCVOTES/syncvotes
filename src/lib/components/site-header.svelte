<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { store } from '$lib/wallet-store.svelte';
	import Brand from './brand.svelte';
	import NavLink from './nav-link.svelte';
	import ThemeToggle from './theme-toggle.svelte';
	import NetworkPill from './network-pill.svelte';

	/** The app's header: brand, nav, theme, network, and the way into the wallet. */
	let { nav }: { nav: { href: string; label: string }[] } = $props();

	const walletLabel = $derived(
		store.who ? store.who.name : store.hasKey ? 'Unlock wallet' : 'Connect wallet'
	);
</script>

<header
	class="sticky top-0 z-50 flex flex-wrap items-center justify-between border-b border-border bg-[rgba(var(--bg-rgb),0.88)] px-4 backdrop-blur-2xl md:h-[68px] md:px-10"
>
	<div class="flex h-[60px] items-center gap-10 md:h-auto">
		<Brand />
		<nav class="hidden items-center gap-1 md:flex">
			{#each nav as item (item.href)}<NavLink href={item.href} label={item.label} />{/each}
		</nav>
	</div>

	<div class="flex items-center gap-2.5">
		<ThemeToggle />
		<NetworkPill />
		<Button href="/wallet" variant="accent" size="sm">
			{#if store.who}<span class="size-2 rounded-full bg-green"></span>{/if}
			{walletLabel}
		</Button>
	</div>

	<!-- On phones the nav gets its own row under the brand. -->
	<nav
		class="-mx-4 flex w-[calc(100%+2rem)] items-center gap-1 border-t border-border px-3 py-1.5 md:hidden"
	>
		{#each nav as item (item.href)}<NavLink href={item.href} label={item.label} size="sm" />{/each}
	</nav>
</header>
