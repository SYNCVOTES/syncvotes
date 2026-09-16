<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import PartyId from './party-id.svelte';

	/**
	 * Members by the hundred: paste party ids, one per line or separated by spaces or commas;
	 * the list is checked against the registry in one call and summarised, then handed over as
	 * party ids for the page to add in batches.
	 */
	let {
		exclude = [],
		busy = false,
		onadd
	}: { exclude?: string[]; busy?: boolean; onadd: (parties: string[]) => void } = $props();

	let text = $state('');
	let checking = $state(false);
	let result = $state<{ registered: string[]; unknown: string[]; skipped: number } | null>(null);

	const tokens = $derived([
		...new Set(
			text
				.split(/[\s,]+/)
				.map((t) => t.trim())
				.filter((t) => t.includes('::'))
		)
	]);
	const fmt = (n: number) => n.toLocaleString('en-US');

	async function check() {
		checking = true;
		try {
			const fresh = tokens.filter((t) => !exclude.includes(t));
			const { registered, unknown } = await remote.checkMembers(fresh.slice(0, 2000));
			result = { registered, unknown, skipped: tokens.length - fresh.length };
		} finally {
			checking = false;
		}
	}
</script>

<div class="space-y-3">
	<Textarea
		rows={5}
		placeholder="Party ids, one per line — alice::1220…"
		class="font-mono text-xs"
		bind:value={text}
		oninput={() => (result = null)}
		disabled={busy}
	/>
	<div class="flex flex-wrap items-center gap-3">
		<Button
			variant="outline"
			size="sm"
			disabled={busy || checking || tokens.length === 0}
			onclick={check}
		>
			{checking ? 'Checking…' : `Check ${fmt(tokens.length)} ${tokens.length === 1 ? 'id' : 'ids'}`}
		</Button>
		{#if result}
			<span class="font-mono text-xs text-ink-dim">
				<span class="text-green">{fmt(result.registered.length)} registered</span>
				{#if result.unknown.length}· <span class="text-red"
						>{fmt(result.unknown.length)} unknown</span
					>{/if}
				{#if result.skipped}· {fmt(result.skipped)} already members{/if}
			</span>
		{/if}
	</div>
	{#if result?.unknown.length}
		<ul class="max-h-32 space-y-1 overflow-auto border border-red/30 bg-red/[0.04] p-3">
			{#each result.unknown.slice(0, 50) as p (p)}
				<li class="font-mono text-xs text-red"><PartyId party={p} /> — not registered</li>
			{/each}
			{#if result.unknown.length > 50}<li class="font-mono text-xs text-ink-dim">
					…and {fmt(result.unknown.length - 50)} more
				</li>{/if}
		</ul>
	{/if}
	{#if result && result.registered.length}
		<Button disabled={busy} onclick={() => onadd(result!.registered)}>
			Add {fmt(result.registered.length)}
			{result.registered.length === 1 ? 'member' : 'members'}
		</Button>
	{/if}
</div>
