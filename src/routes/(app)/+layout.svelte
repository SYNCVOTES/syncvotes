<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { store } from '$lib/wallet-store.svelte';
	import SiteHeader from '$lib/components/site-header.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Activity from '$lib/components/activity.svelte';

	let { children } = $props();

	// A problem belongs to the page it happened on.
	afterNavigate(() => (store.problem = null));

	const nav = [
		{ href: '/my-daos', label: 'My DAOs' },
		{ href: '/profile', label: 'Profile' },
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
