<script lang="ts">
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { topUpForm as schema } from '$lib/schemas';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import Panel from './panel.svelte';
	import Skeleton from './skeleton.svelte';
	import { coin } from '$lib/format';

	/**
	 * The DAO's account: what it holds, what its transactions have cost, and a way to pay in.
	 * Coin goes to the app's provider and is credited to the DAO the moment it lands.
	 */
	let { dao, admin }: { dao: string; admin: boolean } = $props();
	const billing = $derived(store.who ? remote.daoBilling(dao) : null);

	const f = remote.topUpForm;
	let provider = $state('');
	$effect(() => {
		actions.configuration().then((c) => (provider = c.provider));
	});
	const enhanced = signedForm(
		f,
		schema,
		({ amount }) => actions.transferIntent(store.who!.party, provider, amount.toFixed(10)),
		() => f.fields.amount.set(undefined as unknown as number)
	);
</script>

<Panel padding="sm" class="space-y-3">
	<h2 class="eyebrow">Balance</h2>
	{#if billing?.ready}
		{@const b = billing.current}
		<div class="font-mono text-2xl font-bold {b.balance > 0 ? 'text-ink' : 'text-red'}">
			{coin(b.balance)}
		</div>
		<p class="font-mono text-xs text-ink-dim">
			{coin(b.credited)} paid in, {coin(b.charged)} spent on traffic. A megabyte costs {coin(
				b.coinPerMb
			)}{b.factor !== 1 ? ` (${b.factor}× the network's price)` : ''}.
		</p>
		{#if b.balance <= 0}
			<p class="text-[13px] text-red">
				Empty: nothing can be signed for this DAO until an admin pays in.
			</p>
		{/if}
		{#if admin}
			<form {...enhanced} class="flex items-start gap-2">
				<input {...f.fields.dao.as('hidden', dao)} />
				<div class="flex-1">
					<Input
						{...f.fields.amount.as('number')}
						step="any"
						min={0}
						placeholder="CC to pay in"
						aria-label="Coin to pay in"
					/>
					{#each f.fields.amount.issues() as issue (issue.message)}
						<p class="mt-1 text-xs text-red">{issue.message}</p>
					{/each}
				</div>
				<Button type="submit" size="sm" disabled={store.busy || f.pending > 0 || !provider}
					>Pay in</Button
				>
			</form>
		{/if}
	{:else}
		<Skeleton height="h-16" />
	{/if}
</Panel>
