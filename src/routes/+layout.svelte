<script lang="ts">
	import './layout.css';
	import { boot } from '$lib/wallet-store.svelte';
	import { readTheme } from '$lib/theme.svelte';
	import NavProgress from '$lib/components/nav-progress.svelte';

	let { children } = $props();

	$effect(() => {
		readTheme();
		boot();
	});
</script>

<NavProgress />
{@render children()}
