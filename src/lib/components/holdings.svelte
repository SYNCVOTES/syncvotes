<script lang="ts">
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import Panel from './panel.svelte';
	import List from './list.svelte';
	import ListItem from './list-item.svelte';
	import { coin, dateOf, relative } from '$lib/format';

	/**
	 * The signed-in party's Canton Coin: what is free, what is locked and until when. A lock is
	 * how a stake vote weighs; it has no holder, so only its time opens it.
	 */
	type View = Awaited<ReturnType<typeof remote.myHoldings>>;
	let view = $state<View | null>(null);
	let failed = $state<string | null>(null);
	let amount = $state(0);
	let days = $state(30);

	const load = () =>
		remote.myHoldings().then(
			(v) => (view = v),
			(e) => (failed = String(e?.body?.message ?? e))
		);
	$effect(() => {
		if (store.who) void load();
	});

	const free = $derived(view?.holdings.filter((h) => !h.lock) ?? []);
	const locked = $derived(view?.holdings.filter((h) => h.lock) ?? []);
	const sum = (hs: { amount: number }[]) => hs.reduce((s, h) => s + h.amount, 0);
	const lock = async () => {
		if (await flow.act((s, w) => actions.lock(s, w, amount, days))) {
			amount = 0;
			await load();
		}
	};
	const release = async (cid: string) => {
		if (await flow.act((s, w) => actions.release(s, w, cid))) await load();
	};
</script>

<Panel class="space-y-5">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h2 class="eyebrow">Canton Coin</h2>
			{#if view}
				<div class="mt-2 font-mono text-2xl font-bold">{coin(sum(free))}</div>
				<p class="font-mono text-xs text-ink-dim">
					free{locked.length ? `, ${coin(sum(locked))} locked` : ''} · ${view.prices.usdPerCoin.toFixed(
						4
					)}
					a coin
				</p>
			{:else if failed}
				<p class="mt-2 text-[13px] text-red">{failed}</p>
			{:else}
				<p class="mt-2 font-mono text-xs text-ink-dim">Reading the ledger…</p>
			{/if}
		</div>
		<Button variant="ghost" size="sm" onclick={load}>Refresh</Button>
	</div>

	{#if view && free.length > 0}
		<form
			class="flex flex-wrap items-end gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				void lock();
			}}
		>
			<label class="space-y-1">
				<span class="font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">Lock, CC</span>
				<Input type="number" step="any" min={0} max={sum(free)} class="w-36" bind:value={amount} />
			</label>
			<label class="space-y-1">
				<span class="font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">For, days</span>
				<Input type="number" min={1} max={365} class="w-24" bind:value={days} />
			</label>
			<Button type="submit" size="sm" disabled={store.busy || !(amount > 0) || amount > sum(free)}
				>Lock</Button
			>
			<p class="basis-full text-xs text-ink-dim">
				Locked coin stays yours and weighs your votes in stake DAOs on proposals that close before
				the lock does. Nobody, this app included, can open it early.
			</p>
		</form>
	{/if}

	{#if locked.length > 0}
		<List>
			{#each locked as h (h.contractId)}
				{@const due = new Date(h.lock!.expiresAt).getTime() <= Date.now()}
				<ListItem class="flex items-center gap-3 font-mono text-xs">
					<span class="text-ink">{coin(h.amount)}</span>
					<span class="flex-1 text-ink-dim">
						{due
							? `unlockable since ${dateOf(h.lock!.expiresAt)}`
							: `until ${dateOf(h.lock!.expiresAt)} (${relative(h.lock!.expiresAt)})`}
					</span>
					{#if due}
						<Button
							size="sm"
							variant="outline"
							disabled={store.busy}
							onclick={() => release(h.contractId)}>Release</Button
						>
					{/if}
				</ListItem>
			{/each}
		</List>
	{/if}
</Panel>
