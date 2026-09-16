<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow, describe } from '$lib/wallet-store.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Problem from '$lib/components/problem.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import FormSection from '$lib/components/form-section.svelte';
	import Field from '$lib/components/field.svelte';
	import FormActions from '$lib/components/form-actions.svelte';
	import DangerZone from '$lib/components/danger-zone.svelte';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const dao = $derived(me ? remote.dao(id) : null);

	let name = $state('');
	let description = $state('');
	let membersText = $state('');
	let loaded = $state(false);

	// Fill the form once from the live query; later updates must not overwrite what is typed.
	$effect(() => {
		const d = dao?.current;
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
		const contractId = dao?.current?.contractId;
		if (!contractId) return;
		const ok = await flow.act((signer, who) =>
			actions.updateDao(signer, who, contractId, { name, description, members })
		);
		if (ok) await goto(`/daos/${id}`);
	}

	async function remove() {
		const contractId = dao?.current?.contractId;
		if (!contractId) return;
		const ok = await flow.act((signer, who) => actions.archiveDao(signer, who, contractId));
		if (ok) await goto('/my-daos');
	}
</script>

<svelte:head><title>Edit {dao?.current?.name ?? 'DAO'} — SyncVotes</title></svelte:head>

<Page width="narrow" back={{ href: `/daos/${id}`, label: dao?.current?.name ?? 'DAO' }}>
	<PageHeader
		eyebrow="Settings"
		title="Edit DAO"
		description="Changes are signed by your key like everything else. Open proposals keep the member list they were opened with."
	/>

	{#if !dao}
		<ConnectPrompt what="edit this DAO" />
	{:else if dao.error}
		<Problem message={describe(dao.error)} />
	{:else if !dao.ready}
		<Skeleton height="h-64" />
	{:else if dao.current.admin !== me}
		<p class="text-[13px] text-ink-dim">Only the admin can edit this DAO.</p>
	{:else}
		<form class="space-y-8" onsubmit={save}>
			<Problem message={store.problem} />

			<FormSection title="Basic information">
				<Field label="Name" id="name">
					<Input id="name" maxlength={60} bind:value={name} />
				</Field>
				<Field label="Description" id="description">
					<Textarea id="description" rows={4} bind:value={description} />
				</Field>
			</FormSection>

			<FormSection title="Members">
				<Field
					label="Members besides you"
					id="members"
					hint="Members are named by their SyncVotes name. You stay the admin and a member."
				>
					<Textarea
						id="members"
						rows={3}
						placeholder="Names, separated by spaces or commas — alice bob carol"
						bind:value={membersText}
					/>
				</Field>
			</FormSection>

			<FormActions
				label="Save changes"
				busy={store.busy}
				disabled={name.trim().length < 2}
				cancelHref="/daos/{id}"
			/>
		</form>

		<div class="mt-14">
			<DangerZone
				title="Delete DAO"
				text="Archives the DAO on the ledger. Settled proposals stay readable; open ones have to be closed or cancelled first."
				action="Delete DAO"
				confirm="Yes, delete it"
				busy={store.busy}
				onconfirm={remove}
			/>
		</div>
	{/if}
</Page>
