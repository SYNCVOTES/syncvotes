<script lang="ts">
	import SiteHeader from '$lib/components/site-header.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import { NAV, FOOTER_LINKS, GITHUB, X } from '$lib/site';

	/** The site around the app: its legal pages and brand kit, in the same header and footer. */
	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<SiteHeader nav={NAV} />
	<main class="flex-1">
		{@render children()}
	</main>
	<SiteFooter links={FOOTER_LINKS} github={GITHUB} x={X} />
</div>
