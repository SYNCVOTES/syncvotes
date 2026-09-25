<script lang="ts">
	import { page } from '$app/state';
	import { store } from '$lib/wallet-store.svelte';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import { Button } from '$lib/components/ui/button';
</script>

<svelte:head><title>{page.status} — SyncVotes</title></svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
	<a
		href="/"
		class="flex items-center gap-2.5 font-display text-[15px] font-bold tracking-[0.14em]"
	>
		<BrandMark size={16} /> SYNCVOTES
	</a>
	<div class="eyebrow">// {page.status}</div>
	<h1 class="display text-4xl md:text-5xl">
		{page.status === 404 ? 'Page Not Found' : 'Something Went Wrong'}
	</h1>
	<p class="max-w-[420px] text-sm text-ink-mid">
		{page.status === 404
			? "This page doesn't exist."
			: (page.error?.message ?? "This page couldn't load.")}
	</p>
	<div class="flex gap-3">
		{#if store.who}
			<Button href="/my-daos">My DAOs</Button>
			<Button href="/" variant="outline">Home</Button>
		{:else}
			<Button href="/">Home</Button>
			<Button href="/my-daos" variant="outline">My DAOs</Button>
		{/if}
	</div>
</div>
