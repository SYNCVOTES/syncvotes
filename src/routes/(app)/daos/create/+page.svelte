<script lang="ts">
	import { goto } from '$app/navigation';
	import * as actions from '$lib/actions';
	import { store, flow } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import ConnectPrompt from '$lib/components/app/connect-prompt.svelte';
	import Problem from '$lib/components/app/problem.svelte';

	let name = $state('');
	let description = $state('');
	let membersText = $state('');

	const members = $derived(
		membersText
			.split(/[\s,]+/)
			.map((m) => m.trim())
			.filter(Boolean)
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const ok = await flow.act((signer, who) =>
			actions.createDao(signer, who, { name, description, members })
		);
		if (ok) await goto('/my-daos');
	}
</script>

<svelte:head><title>Create DAO — SyncVotes</title></svelte:head>

<div class="mx-auto max-w-[760px] px-6 py-12 md:px-10">
	<PageHeader
		eyebrow="New organisation"
		title="Create DAO"
		description="A DAO is private to its members: only they, and the app as provider, ever see it. You are its admin and first member."
	/>

	{#if !store.who}
		<ConnectPrompt what="create a DAO" />
	{:else}
		<form class="space-y-8" onsubmit={submit}>
			<Problem message={store.problem} />

			<section class="space-y-5 border border-border bg-surface p-6">
				<h2 class="eyebrow">Basic information</h2>
				<div class="space-y-2">
					<Label for="name">Name</Label>
					<Input
						id="name"
						placeholder="Canton Technical Committee"
						maxlength={60}
						bind:value={name}
					/>
				</div>
				<div class="space-y-2">
					<Label for="description">Description</Label>
					<Textarea
						id="description"
						rows={4}
						placeholder="Governs protocol upgrades and technical parameters..."
						bind:value={description}
					/>
				</div>
			</section>

			<section class="space-y-5 border border-border bg-surface p-6">
				<h2 class="eyebrow">Members</h2>
				<div class="space-y-2">
					<Label for="members">Additional members</Label>
					<Textarea
						id="members"
						rows={3}
						placeholder="Names, separated by spaces or commas — alice bob carol"
						bind:value={membersText}
					/>
					<p class="text-xs text-ink-dim">
						Members are named by their SyncVotes name. Membership is fixed at creation in this
						version.
					</p>
				</div>
			</section>

			<div class="flex items-center gap-3">
				<Button type="submit" size="lg" disabled={store.busy || name.trim().length < 2}>
					{store.busy ? 'Signing…' : 'Create DAO'}
				</Button>
				<Button href="/my-daos" variant="ghost">Cancel</Button>
			</div>
		</form>
	{/if}
</div>
