<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
</script>

<svelte:head><title>{page.status} — SyncVotes</title></svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow={String(page.status)}
		title={page.status === 404 ? 'Nothing here' : 'Something went wrong'}
		description={page.status === 404
			? 'That address does not point at anything in SyncVotes.'
			: (page.error?.message ?? 'The page could not be shown.')}
	/>
	<div class="flex gap-3">
		<Button href="/my-daos">My DAOs</Button>
		<Button href="/" variant="outline">Home</Button>
	</div>
</Page>
