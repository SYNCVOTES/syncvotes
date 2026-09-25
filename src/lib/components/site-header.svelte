<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { store } from '$lib/wallet-store.svelte';
	import Brand from './brand.svelte';
	import NavLink from './nav-link.svelte';
	import ThemeToggle from './theme-toggle.svelte';
	import NetworkPill from './network-pill.svelte';
	import { hintOf } from '$lib/format';
	import type { NavItem } from '$lib/site';

	/**
	 * The app's header: brand and network, nav, theme, and the way into the wallet. On a phone
	 * it is one row plus the nav, without the `wide` items; the theme switch lives in the footer there.
	 */
	let { nav }: { nav: NavItem[] } = $props();

	const hint = $derived(store.who ? hintOf(store.who.party) : '');
	const tail = $derived(store.who?.party.split('::')[1]?.slice(4, 8) ?? '');
	// Nothing is unlocked until a key is kept: while one is being made, the way in is the wallet.
	const walletLabel = $derived(store.screen.at === 'locked' ? 'Unlock' : 'Sign in');
</script>

<header
	class="sticky top-0 z-50 border-b border-border bg-[rgba(var(--bg-rgb),0.88)] backdrop-blur-2xl"
>
	<div class="flex h-14 items-center justify-between gap-3 px-4 md:h-[68px] md:px-10">
		<div class="flex min-w-0 items-center gap-3 md:gap-10">
			<div class="flex items-center gap-3">
				<Brand />
				<NetworkPill />
			</div>
			<nav class="hidden items-center gap-1 md:flex">
				{#each nav as item (item.href)}<NavLink href={item.href} label={item.label} />{/each}
			</nav>
		</div>

		<div class="flex shrink-0 items-center gap-2.5">
			<span class="hidden md:flex"><ThemeToggle /></span>
			<Button
				href="/wallet"
				variant="outline"
				size="sm"
				class="max-w-[130px] px-3 md:max-w-[200px]"
			>
				{#if store.who}
					<span class="size-2 shrink-0 rounded-full bg-green" aria-hidden="true"></span>
					<span class="truncate normal-case md:uppercase"
						>{hint}<span class="hidden md:inline"> ·{tail}</span></span
					>
				{:else}
					<span class="truncate">{walletLabel}</span>
				{/if}
			</Button>
		</div>
	</div>

	<!-- On phones the nav gets its own row. -->
	<nav class="flex items-center gap-1 border-t border-border px-3 py-1.5 md:hidden">
		{#each nav.filter((item) => !item.wide) as item (item.href)}<NavLink
				href={item.href}
				label={item.label}
				size="sm"
			/>{/each}
	</nav>
</header>
