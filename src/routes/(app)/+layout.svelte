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
		{ href: '/daos', label: 'Public DAOs' },
		{ href: '/wallet', label: 'Wallet' }
	];
	const GITHUB = 'https://github.com/SYNCVOTES/syncvotes';
	const X = 'https://x.com/syncvotes';
	const links = [
		{ href: '/#moves', label: 'How it works' },
		{ href: '/terms', label: 'Terms' },
		{ href: '/privacy', label: 'Privacy' },
		{ href: '/brand', label: 'Brand kit' },
		{ href: '/version', label: 'Build' },
		{ href: 'https://docs.canton.network', label: 'Canton docs', external: true }
	];
</script>

<div class="flex min-h-screen flex-col">
	<SiteHeader {nav} />
	<main class="flex-1">
		{@render children()}
	</main>
	<SiteFooter {links} github={GITHUB} x={X} />
	<Activity />
</div>
