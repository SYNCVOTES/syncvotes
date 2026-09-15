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

	const id = $derived(page.params.id!);
	const dao = $derived(remote.dao(id));
	const me = $derived(store.who?.party ?? null);

	let name = $state('');
	let description = $state('');
	let membersText = $state('');
	let loaded = $state(false);
	let confirming = $state(false);

	// Fill the form once from the live query; later updates must not overwrite what is typed.
	$effect(() => {
		const d = dao.current;
		if (!d || loaded) return;
		name = d.name;
		description = d.description;
		membersText = d.members
			.filter((m) => m !== d.admin)
			.map((m) => d.names[m] ?? m)
			.join(' ');
		loaded = true;
	});

	const members = $derived(
		membersText
			.split(/[\s,]+/)
			.map((m) => m.trim())
			.filter(Boolean)
	);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const ok = await flow.act((signer, who) =>
			actions.updateDao(signer, who, id, { name, description, members })
		);
		if (ok) await goto(`/daos/${id}`);
	}

	async function remove() {
		const ok = await flow.act((signer, who) => actions.archiveDao(signer, who, id));
		if (ok) await goto('/my-daos');
	}
</script>

<svelte:head><title>Edit {dao.current?.name ?? 'DAO'} — SyncVotes</title></svelte:head>

<div class="mx-auto max-w-[760px] px-6 py-12 md:px-10">
	<a href="/daos/{id}" class="eyebrow hover:text-orange">← {dao.current?.name ?? 'DAO'}</a>
	<div class="mt-6">
		<PageHeader
			eyebrow="Settings"
			title="Edit DAO"
			description="Changes are signed by your key like everything else. Open proposals keep the member list they were opened with."
		/>
	</div>

	{#if dao.error}
		<Problem message={describe(dao.error)} />
	{:else if !store.who}
		<ConnectPrompt what="edit this DAO" />
	{:else if dao.ready && dao.current.admin !== me}
		<p class="text-[13px] text-ink-dim">Only the admin can edit this DAO.</p>
	{:else}
		<form class="space-y-8" onsubmit={save}>
			<Problem message={store.problem} />

			<section class="space-y-5 border border-border bg-surface p-6">
				<h2 class="eyebrow">Basic information</h2>
				<div class="space-y-2">
					<Label for="name">Name</Label>
					<Input id="name" maxlength={60} bind:value={name} />
				</div>
				<div class="space-y-2">
					<Label for="description">Description</Label>
					<Textarea id="description" rows={4} bind:value={description} />
				</div>
			</section>

			<section class="space-y-5 border border-border bg-surface p-6">
				<h2 class="eyebrow">Members</h2>
				<div class="space-y-2">
					<Label for="members">Members besides you</Label>
					<Textarea
						id="members"
						rows={3}
						placeholder="Names, separated by spaces or commas — alice bob carol"
						bind:value={membersText}
					/>
					<p class="text-xs text-ink-dim">
						Members are named by their SyncVotes name. You stay the admin and a member.
					</p>
				</div>
			</section>

			<div class="flex items-center gap-3">
				<Button type="submit" size="lg" disabled={store.busy || name.trim().length < 2}>
					{store.busy ? 'Signing…' : 'Save changes'}
				</Button>
				<Button href="/daos/{id}" variant="ghost">Cancel</Button>
			</div>
		</form>

		<section class="mt-14 space-y-4 border border-red/30 bg-red/[0.04] p-6">
			<h2 class="eyebrow text-red">Delete DAO</h2>
			<p class="text-[13px] text-ink-mid">
				Archives the DAO on the ledger. Settled proposals stay readable; open ones have to be closed
				or cancelled first.
			</p>
			{#if confirming}
				<div class="flex items-center gap-3">
					<Button variant="destructive" disabled={store.busy} onclick={remove}>
						{store.busy ? 'Signing…' : 'Yes, delete it'}
					</Button>
					<Button variant="ghost" onclick={() => (confirming = false)}>Keep it</Button>
				</div>
			{:else}
				<Button variant="destructive" onclick={() => (confirming = true)}>Delete DAO</Button>
			{/if}
		</section>
	{/if}
</div>
