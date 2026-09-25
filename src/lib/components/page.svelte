<script lang="ts">
	import type { Snippet } from 'svelte';
	import BackLink from './back-link.svelte';

	/** The page column: one of three widths, with an optional way back above the content. */
	let {
		width = 'default',
		back,
		children
	}: {
		width?: 'narrow' | 'default' | 'wide';
		back?: { href: string; label: string };
		children: Snippet;
	} = $props();

	const widths = { narrow: 'max-w-[760px]', default: 'max-w-[900px]', wide: 'max-w-[1120px]' };
</script>

<div class="mx-auto {widths[width]} px-6 py-8 md:px-10 md:py-12">
	{#if back}
		<div class="mb-6"><BackLink href={back.href} label={back.label} /></div>
	{/if}
	{@render children()}
</div>
