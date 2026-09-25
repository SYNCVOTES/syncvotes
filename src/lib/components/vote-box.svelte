<script lang="ts">
	import type * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Panel from './panel.svelte';
	import Note from './note.svelte';
	import Problem from './problem.svelte';
	import UnlockForm from './unlock-form.svelte';
	import Loader from '@lucide/svelte/icons/loader';

	/**
	 * Where a member casts their vote: yes, no or abstain, an option, or several; how much it
	 * weighs; the vote already cast and whether it may still change. On a phone, once the box
	 * scrolls out of view, the buttons follow along the bottom of the screen.
	 */
	type Proposal = NonNullable<ReturnType<typeof remote.proposal>['current']>;
	let { p, id, now }: { p: Proposal; id: string; now: number } = $props();

	// Every write lands on this page through the live query; nothing to refresh by hand. The
	// button pressed says so until the ledger answers; the activity pill says what is happening.
	let casting = $state<actions.Choice | null>(null);
	let changing = $state(false);
	async function vote(choice: actions.Choice) {
		if (!p?.me.membership) return;
		const membership = p.me.membership;
		casting = choice;
		try {
			await flow.act((s, w) =>
				actions.vote(s, w, id, choice, membership, p.closesAt, p.rule.changeable, p.me.ballot)
			);
			changing = false;
		} finally {
			casting = null;
		}
	}
	const tone = (v: string) =>
		v === 'Yes'
			? 'text-green'
			: v === 'No'
				? 'text-red'
				: v === 'Abstain'
					? 'text-ink-dim'
					: 'text-ink';
	/** The options a vote picked, by index; none for yes, no, abstain. */
	const picksOf = (v: string): number[] => {
		const m = /^(?:Pick|Chosen|PickMany|ChosenMany):(.*)$/.exec(v);
		return m ? m[1].split(',').filter(Boolean).map(Number) : [];
	};
	/** A vote as words: yes, no, abstain, or the options picked. */
	const said = (v: string, options: string[] = []) => {
		const picks = picksOf(v);
		return picks.length ? picks.map((i) => options[i] ?? `option ${i + 1}`).join(', ') : v;
	};
	// On a choice that takes several picks, the options ticked before the ballot is cast.
	let picks = $state<number[]>([]);
	const toggle = (i: number) =>
		(picks = picks.includes(i)
			? picks.filter((j) => j !== i)
			: [...picks, i].sort((a, b) => a - b));
	const pct = (units: number, of: number) => (of > 0 ? Math.round((units / of) * 1000) / 10 : 0);

	const ended = $derived(new Date(p.closesAt).getTime() < now);
	const tooLate = $derived(new Date(p.closesAt).getTime() - now < 90_000);
	const canVote = $derived(!p.outcome && !ended && !tooLate && p.me.mayVote);
	const showBox = $derived(canVote && (!p.me.vote || changing));
	const options = $derived(p.effect.kind === 'choose' ? p.effect.options : []);
	const yesNo = $derived(p.effect.kind !== 'choose');

	// The phone's bar: shown while the box is on the page but out of view.
	let box = $state<HTMLElement | null>(null);
	let away = $state(false);
	$effect(() => {
		if (!box) return;
		const io = new IntersectionObserver(([e]) => (away = !e.isIntersecting));
		io.observe(box);
		return () => io.disconnect();
	});
</script>

{#if !p.outcome && !ended}
	{#if store.screen.at === 'locked'}
		<Panel class="space-y-3">
			<h2 class="eyebrow">Your vote</h2>
			<p class="text-body-sm text-ink-dim">Unlock your wallet to vote.</p>
			<UnlockForm />
		</Panel>
	{:else if showBox}
		<div bind:this={box}>
			<Panel class="space-y-3">
				<h2 class="eyebrow">Your vote</h2>
				<Problem message={store.problem} />
				<p class="text-body-sm text-ink-mid">
					{#if changing}You voted {said(p.me.vote ?? '', options)}. Vote again to change it.{:else}Your
						voting power: {pct(p.me.weight ?? 0, p.eligible)}%.{/if}
				</p>
				{#if p.effect.kind === 'choose' && p.effect.several}
					<div class="grid gap-2">
						{#each p.effect.options as o, i (i)}
							<label
								class="flex cursor-pointer items-center gap-3 border px-3 py-2 text-body-sm transition-colors {picks.includes(
									i
								)
									? 'border-orange bg-orange-dim text-ink'
									: 'border-border text-ink-mid hover:border-border-hover'}"
							>
								<input
									type="checkbox"
									class="accent-orange"
									checked={picks.includes(i)}
									disabled={store.busy}
									onchange={() => toggle(i)}
								/>
								{o}
							</label>
						{/each}
					</div>
					<Button
						class="w-full"
						disabled={store.busy || picks.length === 0}
						onclick={() => vote(`PickMany:${picks.join(',')}`)}
					>
						{#if casting?.startsWith('PickMany:')}<Loader
								size={14}
								class="animate-spin"
							/>{/if}{picks.length > 0
							? `Vote for ${picks.length} ${picks.length === 1 ? 'option' : 'options'}`
							: 'Vote'}
					</Button>
				{:else if p.effect.kind === 'choose'}
					<div class="grid gap-2">
						{#each p.effect.options as o, i (i)}
							<Button
								variant="outline"
								class="h-auto min-h-10 justify-start py-2 text-left whitespace-normal normal-case"
								disabled={store.busy}
								onclick={() => vote(`Pick:${i}`)}
							>
								{#if casting === `Pick:${i}`}<Loader size={14} class="animate-spin" />{/if}{o}
							</Button>
						{/each}
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-3">
						<Button variant="yes" disabled={store.busy} onclick={() => vote('Yes')}>
							{#if casting === 'Yes'}<Loader size={14} class="animate-spin" />{/if}Yes
						</Button>
						<Button variant="destructive" disabled={store.busy} onclick={() => vote('No')}>
							{#if casting === 'No'}<Loader size={14} class="animate-spin" />{/if}No
						</Button>
					</div>
				{/if}
				<Button
					variant="ghost"
					size="sm"
					class="w-full"
					disabled={store.busy}
					onclick={() => vote('Abstain')}
				>
					{#if casting === 'Abstain'}<Loader size={14} class="animate-spin" />{/if}Abstain
				</Button>
				{#if changing}
					<Button variant="ghost" size="sm" class="w-full" onclick={() => (changing = false)}
						>Cancel</Button
					>
				{/if}
			</Panel>
		</div>
		{#if yesNo && away}
			<div
				class="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-border bg-[rgba(var(--bg-rgb),0.96)] px-4 py-3 backdrop-blur lg:hidden"
			>
				<Button variant="yes" class="flex-1" disabled={store.busy} onclick={() => vote('Yes')}>
					{#if casting === 'Yes'}<Loader size={14} class="animate-spin" />{/if}Yes
				</Button>
				<Button
					variant="destructive"
					class="flex-1"
					disabled={store.busy}
					onclick={() => vote('No')}
				>
					{#if casting === 'No'}<Loader size={14} class="animate-spin" />{/if}No
				</Button>
				<Button variant="ghost" disabled={store.busy} onclick={() => vote('Abstain')}>
					{#if casting === 'Abstain'}<Loader size={14} class="animate-spin" />{/if}Abstain
				</Button>
			</div>
		{/if}
	{:else if p.me.vote}
		<Panel class="space-y-2">
			<h2 class="eyebrow">Your vote</h2>
			<p class="text-body-sm text-ink-mid">
				You voted <span class={tone(p.me.vote)}
					>{p.me.vote === 'Abstain' ? 'to abstain' : said(p.me.vote, options)}</span
				>{p.me.weight !== null ? ` with ${pct(p.me.weight, p.eligible)}%` : ''}.
			</p>
			{#if canVote}
				<Button variant="outline" size="sm" onclick={() => (changing = true)}>Change vote</Button>
			{:else if p.rule.changeable}
				<p class="font-mono text-xs text-ink-dim">Counted. Final.</p>
			{/if}
		</Panel>
	{:else if p.me.membership && tooLate}
		<Note>Voting closes in under 90 seconds.</Note>
	{:else if p.me.membership}
		<Note
			>{p.me.reshared
				? "Your units changed after this vote opened, so you can't vote."
				: "You joined after this vote opened, so you can't vote."}</Note
		>
	{/if}
{/if}
