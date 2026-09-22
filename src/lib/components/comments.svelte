<script lang="ts">
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { commentForm as schema, editCommentForm as editSchema } from '$lib/schemas';
	import { Button } from '$lib/components/ui/button';
	import MarkdownEditor from './markdown-editor.svelte';
	import Markdown from './markdown.svelte';
	import Avatar from './avatar.svelte';
	import PartyId from './party-id.svelte';
	import Problem from './problem.svelte';
	import Skeleton from './skeleton.svelte';
	import QueryError from './query-error.svelte';
	import UnlockForm from './unlock-form.svelte';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { relative } from '$lib/format';

	/**
	 * The thread under a proposal, the way one runs under a pull request: who said what, when,
	 * in Markdown; one's own words can be edited or removed. Every comment is a signed
	 * transaction of its author, and the DAO pays its traffic like any other.
	 */
	let { proposal, member }: { proposal: string; member: boolean } = $props();
	const comments = $derived(store.who ? remote.proposalComments(proposal) : null);

	let body = $state('');
	const f = remote.commentForm;
	const enhanced = signedForm(
		f,
		schema,
		(fields, r) => ({
			choice: 'Member_Comment',
			contractId: r.membership,
			args: { proposalId: r.proposalId, cid: r.cid, body: fields.body }
		}),
		() => (body = '')
	);

	let editing = $state<string | null>(null);
	let draft = $state('');
	const e = remote.editCommentForm;
	const enhancedEdit = signedForm(
		e,
		editSchema,
		(fields, r) => ({
			choice: 'Comment_Edit',
			contractId: r.comment,
			args: { newBody: fields.body }
		}),
		() => (editing = null)
	);
	let removing = $state<string | null>(null);
	async function remove(contractId: string) {
		removing = contractId;
		try {
			await flow.act((s, w) => actions.deleteComment(s, w, contractId));
		} finally {
			removing = null;
		}
	}
</script>

<div class="space-y-4">
	<h2 class="eyebrow">
		Comments{comments?.ready && comments.current.length ? ` · ${comments.current.length}` : ''}
	</h2>

	{#if comments?.error}
		<QueryError error={comments.error} refresh={() => comments?.reconnect()} />
	{:else if !comments?.ready}
		<Skeleton height="h-16" />
	{:else if comments.current.length === 0}
		<p class="text-[13px] text-ink-dim">Nothing said yet.</p>
	{:else}
		<ol class="space-y-3">
			{#each comments.current as c (c.id)}
				<li class="flex gap-3">
					<Avatar who={c.who} size="md" class="mt-1" />
					<div class="min-w-0 flex-1 border border-border">
						<div
							class="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-surface-hover px-3 py-1.5 font-mono text-xs"
						>
							{#if c.who.name}<span class="font-display font-bold text-ink">{c.who.name}</span>{/if}
							<PartyId
								party={c.author}
								class={c.mine ? '[&>span>span:first-child]:text-orange' : ''}
							/>
							<span class="text-ink-dim"
								>{relative(c.createdAt)}{c.editedAt ? ' · edited' : ''}</span
							>
							{#if c.mine && !c.editedAt && editing !== c.contractId}
								<span class="ml-auto flex items-center gap-1">
									<button
										type="button"
										class="p-1 text-ink-dim hover:text-ink"
										title="Edit"
										aria-label="Edit"
										disabled={store.busy}
										onclick={() => {
											editing = c.contractId;
											draft = c.body;
										}}><Pencil size={12} /></button
									>
									<button
										type="button"
										class="p-1 text-ink-dim hover:text-red"
										title="Delete"
										aria-label="Delete"
										disabled={store.busy}
										onclick={() => remove(c.contractId)}><Trash size={12} /></button
									>
								</span>
							{:else if c.mine && editing !== c.contractId}
								<span class="ml-auto">
									<button
										type="button"
										class="p-1 text-ink-dim hover:text-red"
										title="Delete"
										aria-label="Delete"
										disabled={store.busy}
										onclick={() => remove(c.contractId)}><Trash size={12} /></button
									>
								</span>
							{/if}
						</div>
						{#if editing === c.contractId}
							<form {...enhancedEdit} class="space-y-2 p-3">
								<input {...e.fields.comment.as('hidden', c.contractId)} />
								<MarkdownEditor
									name="body"
									bind:value={draft}
									compact
									maxlength={5000}
									disabled={store.busy}
								/>
								<Problem message={store.problem} />
								<div class="flex gap-2">
									<Button type="submit" size="sm" disabled={store.busy || !draft.trim()}>
										{store.busy ? 'Signing…' : 'Save'}
									</Button>
									<Button type="button" variant="ghost" size="sm" onclick={() => (editing = null)}
										>Cancel</Button
									>
								</div>
							</form>
						{:else}
							<div class="px-3 py-2.5 {removing === c.contractId ? 'opacity-50' : ''}">
								<Markdown text={c.body} />
							</div>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
	{/if}

	{#if member}
		{#if store.screen.at === 'locked'}
			<div class="space-y-2 border border-border p-3">
				<p class="text-[13px] text-ink-dim">Unlock your wallet to comment.</p>
				<UnlockForm />
			</div>
		{:else if store.who}
			<form {...enhanced} class="space-y-2">
				<input {...f.fields.proposal.as('hidden', proposal)} />
				<MarkdownEditor
					name="body"
					bind:value={body}
					compact
					maxlength={5000}
					placeholder="Say something about this proposal…"
					disabled={store.busy}
				/>
				{#if editing === null}<Problem message={store.problem} />{/if}
				<div class="flex items-center gap-3">
					<Button type="submit" size="sm" disabled={store.busy || !body.trim()}>
						{store.busy ? 'Signing…' : 'Comment'}
					</Button>
					<span class="font-mono text-[0.6875rem] text-ink-dim"
						>Signed with your key; the DAO pays the traffic.</span
					>
				</div>
			</form>
		{/if}
	{/if}
</div>
