<script lang="ts">
	import './layout.css';
	import { boot } from '$lib/wallet-store.svelte';
	import { readTheme } from '$lib/theme.svelte';

	let { children } = $props();

	$effect(() => {
		readTheme();
		boot();
	});
</script>

{@render children()}
