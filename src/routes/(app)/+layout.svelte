<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { store } from '$lib/wallet-store.svelte';
	import SiteHeader from '$lib/components/site-header.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Activity from '$lib/components/activity.svelte';
	import { NAV, FOOTER_LINKS, GITHUB, X } from '$lib/site';

	let { children } = $props();

	// A problem belongs to the page it happened on.
	afterNavigate(() => (store.problem = null));
</script>

<div class="flex min-h-screen flex-col">
	<SiteHeader nav={NAV} />
	<main class="flex-1">
		{@render children()}
	</main>
	<SiteFooter links={FOOTER_LINKS} github={GITHUB} x={X} />
	<Activity />
</div>
