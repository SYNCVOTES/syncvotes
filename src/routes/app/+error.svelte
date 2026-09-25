<script lang="ts">
	import { page } from '$app/state';
	import { store } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
</script>

<svelte:head><title>{page.status} — SyncVotes</title></svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow={String(page.status)}
		title={page.status === 404 ? 'Page Not Found' : 'Something Went Wrong'}
		description={page.status === 404
			? "This page doesn't exist."
			: (page.error?.message ?? "This page couldn't load.")}
	/>
	<!-- My DAOs asks a signed-out visitor to sign in first; home is the way on for them. -->
	<div class="flex flex-wrap gap-3">
		{#if store.who}
			<Button href="/app/my-daos">My DAOs</Button>
			<Button href="/" variant="outline">Home</Button>
		{:else}
			<Button href="/">Home</Button>
			<Button href="/app/my-daos" variant="outline">My DAOs</Button>
		{/if}
	</div>
</Page>
