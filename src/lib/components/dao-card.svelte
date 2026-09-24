<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
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
		/** The viewer's share of the vote, in percent. */
		share?: number | null;
		/** Whether anyone signed in may read it; null where the list already says so. */
		isPublic?: boolean | null;
		/** Open proposals still waiting on the viewer's vote; null for a DAO they only read. */
		awaiting?: number | null;
	} = $props();
	import { excerpt } from '$lib/markdown';
	import { coin } from '$lib/format';

	const monogram = $derived(name.slice(0, 3).toUpperCase());
</script>

<a
	href="/daos/{id}"
	class="group flex flex-col border border-border bg-surface px-[26px] pt-[26px] pb-5 transition-colors hover:border-border-hover hover:bg-surface-hover"
>
	<div class="mb-[18px] flex items-start justify-between gap-3">
		{#if image}
			<img src={image} alt="" class="size-[46px] shrink-0 border border-border object-cover" />
		{:else}
			<div
				class="flex size-[46px] shrink-0 items-center justify-center border border-orange/30 bg-orange-dim font-mono text-xs font-bold tracking-[0.08em] text-orange"
			>
				{monogram}
			</div>
		{/if}
		<span class="flex items-center gap-2 pt-1 font-mono text-xs tracking-[0.18em] uppercase">
			{#if isPublic !== null}
				<span class={isPublic ? 'text-green' : 'text-ink-dim'}
					>{isPublic ? 'public' : 'private'}</span
				>
			{/if}
			{#if role}
				<span class="font-bold {role === 'creator' ? 'text-amber' : 'text-orange'}">{role}</span>
			{/if}
		</span>
	</div>

	<div
		class="mb-2 line-clamp-2 font-display text-[17px] leading-tight font-bold tracking-[-0.01em] [overflow-wrap:anywhere]"
	>
		{name}
	</div>
	<div
		class="mb-[22px] line-clamp-3 flex-1 text-[12.5px] leading-relaxed [overflow-wrap:anywhere] text-ink-mid"
	>
		{excerpt(description) || 'No description provided.'}
	</div>

	<div class="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-3.5">
		<div>
			<div class="font-mono text-[15px] font-bold">{members}</div>
			<div class="mt-0.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">Members</div>
		</div>
		<div>
			<div class="font-mono text-[15px] font-bold {openProposals > 0 ? 'text-orange' : ''}">
				{openProposals}
			</div>
			<div class="mt-0.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">Open</div>
		</div>
		{#if awaiting !== null}
			<div>
				<div class="font-mono text-[15px] font-bold {awaiting > 0 ? 'text-orange' : ''}">
					{awaiting}
				</div>
				<div class="mt-0.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">
					Your vote due
				</div>
			</div>
		{/if}
		{#if actorPays}
			<div>
				<div class="font-mono text-[15px] font-bold">members</div>
				<div class="mt-0.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">
					Who pays
				</div>
			</div>
		{:else if balance !== null}
			<div>
				<div class="font-mono text-[15px] font-bold {balance <= 0 ? 'text-red' : ''}">
					{coin(balance)}
				</div>
				<div class="mt-0.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">Balance</div>
			</div>
		{/if}
		{#if share !== null}
			<div>
				<div class="font-mono text-[15px] font-bold">{share}%</div>
				<div class="mt-0.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">
					Your vote
				</div>
			</div>
		{/if}
		<ArrowRight
			size={16}
			class="ml-auto text-ink-dim transition-all group-hover:translate-x-0.5 group-hover:text-orange"
			aria-hidden="true"
		/>
	</div>
</a>
