<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import ConnectPrompt from '$lib/components/app/connect-prompt.svelte';
	import Problem from '$lib/components/app/problem.svelte';
	import BackLink from '$lib/components/app/back-link.svelte';

	const id = $derived(page.params.id!);
	const dao = $derived(store.who ? remote.dao(id) : null);

	let title = $state('');
	let description = $state('');
	let days = $state(7);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const period = Math.min(30, Math.max(1, Math.round(Number(days) || 0)));
		const ok = await flow.act((signer, who) =>
			actions.createProposal(signer, who, {
				dao: dao!.current!.contractId,
				title,
				description,
				days: period
			})
		);
		if (ok) await goto(`/daos/${id}`);
	}
</script>

<svelte:head><title>New proposal — SyncVotes</title></svelte:head>

<div class="mx-auto max-w-[760px] px-6 py-12 md:px-10">
	<BackLink href="/daos/{id}" label={dao?.current?.name ?? 'DAO'} />
	<div class="mt-6">
		<PageHeader
			eyebrow="New proposal"
			title="Propose"
			description="Every member gets one vote, Yes or No. The proposal passes when a majority of all members voted Yes, and can be closed as soon as that is settled."
		/>
	</div>

	{#if !store.who}
		<ConnectPrompt what="propose" />
	{:else}
		<form class="space-y-8" onsubmit={submit}>
			<Problem message={store.problem} />

			<section class="space-y-5 border border-border bg-surface p-6">
				<div class="space-y-2">
					<Label for="title">Title</Label>
					<Input id="title" placeholder="Adopt the Q4 budget" maxlength={120} bind:value={title} />
				</div>
				<div class="space-y-2">
					<Label for="description">Description</Label>
					<Textarea
						id="description"
						rows={6}
						placeholder="What is being decided, and why."
						bind:value={description}
					/>
				</div>
				<div class="space-y-2">
					<Label for="days">Voting period (days)</Label>
					<Input id="days" type="number" min={1} max={30} class="w-32" bind:value={days} />
				</div>
			</section>

			<div class="flex items-center gap-3">
				<Button type="submit" size="lg" disabled={store.busy || title.trim().length < 2}>
					{store.busy ? 'Signing…' : 'Create proposal'}
				</Button>
				<Button href="/daos/{id}" variant="ghost">Cancel</Button>
			</div>
		</form>
	{/if}
</div>
