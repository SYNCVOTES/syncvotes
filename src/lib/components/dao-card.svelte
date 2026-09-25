<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Lock from '@lucide/svelte/icons/lock';
	import Globe from '@lucide/svelte/icons/globe';
	import Tag from './tag.svelte';
	import { excerpt } from '$lib/markdown';
	import { coin, fmt } from '$lib/format';

	let {
		id,
		name,
		description,
		members,
		openProposals,
		role,
		image = null,
		balance = null,
		actorPays = false,
		share = null,
		isPublic = null,
		awaiting = null
	}: {
		id: string;
		name: string;
		description: string;
		members: number;
		openProposals: number;
		/** The viewer's part in it; null for a DAO they only read. */
		role: 'creator' | 'member' | null;
		image?: string | null;
		/** What the DAO can still spend; meaningless where each member pays. */
		balance?: number | null;
		/** Each member pays for what they sign: the DAO has no balance of its own. */
		actorPays?: boolean;
		/** The viewer's voting power, in percent; null where it says nothing (by membership). */
		share?: number | null;
		/** Whether anyone signed in may read it; null where the list already says so. */
		isPublic?: boolean | null;
		/** Open proposals still waiting on the viewer's vote; null for a DAO they only read. */
		awaiting?: number | null;
	} = $props();

	const monogram = $derived(name.slice(0, 3).toUpperCase());
	const meta = $derived(
		[
			`${fmt(members)} ${members === 1 ? 'member' : 'members'}`,
			`${fmt(openProposals)} open`,
			share !== null ? `${share}% of the vote` : ''
		]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<a
	href="/app/daos/{id}"
	class="group flex flex-col border bg-surface p-5 transition-colors hover:border-border-hover hover:bg-surface-hover md:p-6 {awaiting
		? 'border-orange/40'
		: 'border-border'}"
>
	<div class="mb-4 flex items-start justify-between gap-3">
		{#if image}
			<img
				referrerpolicy="no-referrer"
				src={image}
				alt=""
				class="size-[46px] shrink-0 border border-border object-cover"
			/>
		{:else}
			<div
				class="flex size-[46px] shrink-0 items-center justify-center border border-border bg-surface-active font-mono text-xs font-bold tracking-[0.08em] text-ink-mid"
			>
				{monogram}
			</div>
		{/if}
		{#if awaiting}
			<span
				class="flex items-center gap-1.5 rounded-full bg-orange-dim px-2.5 py-1 font-mono text-label tracking-[0.12em] text-orange uppercase"
			>
				<span class="size-1.5 rounded-full bg-orange" aria-hidden="true"></span>
				{fmt(awaiting)} not voted
			</span>
		{/if}
	</div>

	<div
		class="mb-2 line-clamp-2 font-display text-item leading-tight font-bold [overflow-wrap:anywhere]"
	>
		{name}
	</div>
	<div
		class="mb-4 line-clamp-3 flex-1 text-body-sm leading-relaxed [overflow-wrap:anywhere] text-ink-mid"
	>
		{excerpt(description) || 'No description.'}
	</div>

	<p class="mb-3 font-mono text-xs text-ink-dim">{meta}</p>
	<div class="flex flex-wrap items-center gap-2 border-t border-border pt-3">
		{#if isPublic !== null}
			<Tag icon={isPublic ? Globe : Lock}>{isPublic ? 'Public' : 'Private'}</Tag>
		{/if}
		{#if role}<Tag>{role}</Tag>{/if}
		{#if !actorPays && balance !== null}
			<span class="ml-auto font-mono text-xs {balance <= 0 ? 'text-red' : 'text-ink-mid'}"
				>{coin(balance)}</span
			>
		{/if}
		<ArrowRight
			size={16}
			class="{!actorPays && balance !== null
				? ''
				: 'ml-auto'} text-ink-dim transition-all group-hover:translate-x-0.5 group-hover:text-orange"
			aria-hidden="true"
		/>
	</div>
</a>
