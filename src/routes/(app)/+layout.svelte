<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { updated } from '$app/state';
	import { store } from '$lib/wallet-store.svelte';
	import SiteHeader from '$lib/components/site-header.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Activity from '$lib/components/activity.svelte';

	let { children } = $props();

	// A problem belongs to the page it happened on.
	afterNavigate(() => (store.problem = null));

	const nav = [
		{ href: '/my-daos', label: 'My DAOs' },
		{ href: '/daos', label: 'Public DAOs' },
		{ href: '/wallet', label: 'Wallet' }
	];
	const GITHUB = 'https://github.com/SYNCVOTES/syncvotes';
	const X = 'https://x.com/syncvotes';
	const links = [
		{ href: GITHUB, label: 'GitHub' },
		{ href: X, label: 'X' },
		{ href: 'https://docs.canton.network', label: 'Canton docs' }
	];
</script>

<div class="flex min-h-screen flex-col">
	<SiteHeader {nav} />
	{#if updated.current}
		<div
			class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-orange/30 bg-orange-dim px-4 py-2 text-center font-mono text-xs text-ink"
		>
			A new version of SyncVotes is out; this page is running the old one.
			<button type="button" class="underline hover:text-orange" onclick={() => location.reload()}
				>Reload</button
			>
			<span class="text-ink-dim">(the key locks; unlock it again)</span>
		</div>
	{/if}
	<main class="flex-1">
		{@render children()}
	</main>
	<SiteFooter
		nav={[...nav, { href: '/#moves', label: 'How it works' }]}
		{links}
		github={GITHUB}
		x={X}
	/>
	<Activity />
</div>
