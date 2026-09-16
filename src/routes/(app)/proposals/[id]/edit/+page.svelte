<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow, describe } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import ConnectPrompt from '$lib/components/app/connect-prompt.svelte';
	import Problem from '$lib/components/app/problem.svelte';
	import BackLink from '$lib/components/app/back-link.svelte';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const proposal = $derived(me ? remote.proposal(id) : null);

	let title = $state('');
	let description = $state('');
	let loaded = $state(false);

	$effect(() => {
		const p = proposal?.current;
		if (!p || loaded) return;
		title = p.title;
		description = p.description;
		loaded = true;
	});

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const contractId = proposal?.current?.contractId;
		if (!contractId) return;
		const ok = await flow.act((signer, who) =>
			actions.updateProposal(signer, who, contractId, { title, description })
		);
		if (ok) await goto(`/proposals/${id}`);
	}
</script>

<svelte:head><title>Edit proposal — SyncVotes</title></svelte:head>

<div class="mx-auto max-w-[760px] px-6 py-12 md:px-10">
	<BackLink href="/proposals/{id}" label={proposal?.current?.title ?? 'Proposal'} />
	<div class="mt-6">
		<PageHeader
			eyebrow="Settings"
			title="Edit proposal"
			description="The text can change until the first ballot is cast; the deadline cannot."
		/>
	</div>

	{#if !proposal}
		<ConnectPrompt what="edit this proposal" />
	{:else if proposal.error}
		<Problem message={describe(proposal.error)} />
	{:else if !proposal.ready}
		<div class="h-64 animate-pulse border border-border bg-surface"></div>
	{:else if proposal.current.proposer !== me}
		<p class="text-[13px] text-ink-dim">Only the proposer can edit.</p>
	{:else if proposal.current.ballots.length > 0}
		<p class="text-[13px] text-ink-dim">Voting has started; the text is fixed now.</p>
	{:else}
		<form class="space-y-8" onsubmit={save}>
			<Problem message={store.problem} />
			<section class="space-y-5 border border-border bg-surface p-6">
				<div class="space-y-2">
					<Label for="title">Title</Label>
					<Input id="title" maxlength={120} bind:value={title} />
				</div>
				<div class="space-y-2">
					<Label for="description">Description</Label>
					<Textarea id="description" rows={8} bind:value={description} />
				</div>
			</section>
			<div class="flex items-center gap-3">
				<Button type="submit" size="lg" disabled={store.busy || title.trim().length < 2}>
					{store.busy ? 'Signing…' : 'Save changes'}
				</Button>
				<Button href="/proposals/{id}" variant="ghost">Cancel</Button>
			</div>
		</form>
	{/if}
</div>
