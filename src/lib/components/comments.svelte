<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { commentForm as schema } from '$lib/schemas';
	import { Button } from '$lib/components/ui/button';
	import MarkdownEditor from './markdown-editor.svelte';
	import Markdown from './markdown.svelte';
	import Avatar from './avatar.svelte';
	import PartyId from './party-id.svelte';
	import Problem from './problem.svelte';
	import Skeleton from './skeleton.svelte';
	import QueryError from './query-error.svelte';
	import UnlockForm from './unlock-form.svelte';
	import { relative } from '$lib/format';

	/**
	 * The thread under a proposal, the way one runs under a pull request: who said what, when,
	 * in Markdown, said once and kept as said. Every comment is a signed transaction of its
	 * author, and its traffic is paid like any other: by the DAO, or by the author where each
	 * member pays.
	 */
	let {
		proposal,
		member,
		actorPays = false
	}: { proposal: string; member: boolean; actorPays?: boolean } = $props();
	let limit = $state(20);
	const comments = $derived(store.who ? remote.proposalComments({ id: proposal, limit }) : null);

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
</script>

<div class="space-y-4">
	<h2 class="eyebrow">
		Comments{comments?.ready && comments.current.total ? ` · ${comments.current.total}` : ''}
	</h2>

	{#if comments?.error}
		<QueryError error={comments.error} refresh={() => comments?.reconnect()} />
	{:else if !comments?.ready}
		<Skeleton height="h-16" />
	{:else if comments.current.total === 0}
		<p class="text-[13px] text-ink-dim">Nothing said yet.</p>
	{:else}
		{#if comments.current.total > comments.current.items.length}
			<button
				type="button"
				class="font-mono text-xs text-ink-dim underline hover:text-ink"
				onclick={() => (limit = Math.min(1000, limit * 2))}
				>Show earlier comments ({(
					comments.current.total - comments.current.items.length
				).toLocaleString('en-US')} more)</button
			>
		{/if}
		<ol class="space-y-3">
			{#each comments.current.items as c (c.id)}
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
							<span class="text-ink-dim">{relative(c.createdAt)}</span>
						</div>
						<div class="px-3 py-2.5">
							<Markdown text={c.body} />
						</div>
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
				<Problem message={store.problem} />
				<div class="flex items-center gap-3">
					<Button type="submit" size="sm" disabled={store.busy || !body.trim()}>
						{store.busy ? 'Signing…' : 'Comment'}
					</Button>
					<span class="font-mono text-[0.6875rem] text-ink-dim"
						>Signed with your key; {actorPays
							? 'you pay the traffic from your balance'
							: 'the DAO pays the traffic'} — a few CC per write at today's prices.</span
					>
				</div>
			</form>
		{/if}
	{/if}
</div>
