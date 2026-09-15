<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { boot } from '$lib/wallet-store.svelte';
	import { readTheme } from '$lib/theme.svelte';

	let { children } = $props();

	$effect(() => {
		readTheme();
		boot();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
