<script lang="ts">
	import { store, flow } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Panel from './panel.svelte';
	import SectionTitle from './section-title.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import { dateOf } from '$lib/format';

	/** Every key kept on this device: select another, add one, or forget one. */
	const screen = $derived(store.screen);
</script>

<Panel padding="lg" class="space-y-4">
	<SectionTitle title="Wallet sources" count={store.wallets.length} />
	<ul class="divide-y divide-border">
		{#each store.wallets as w (w.id)}
			{@const unlocked = screen.at === 'home' && w.party === screen.who.party}
			{@const offered = screen.at === 'locked' && w.id === store.selected}
			<li class="flex items-center gap-4 py-3.5">
				<div class="min-w-0 flex-1">
					<div class="font-mono text-sm {unlocked || offered ? 'text-orange' : 'text-ink'}">
						{w.name || 'Wallet'}
					</div>
					<div class="mt-0.5 font-mono text-xs text-ink-dim">
						{w.lock === 'passkey' ? 'Passkey' : 'Password'}{w.created
							? ` · ${dateOf(w.created)}`
							: ''}
					</div>
				</div>
				{#if unlocked}
					<span class="flex items-center gap-2 font-mono text-xs text-green">
						<span class="size-2 rounded-full bg-green"></span> unlocked
					</span>
				{:else if offered}
					<span class="font-mono text-xs text-ink-dim">selected</span>
				{:else}
					<Button variant="accent" size="sm" onclick={() => flow.select(w.id)}>Select</Button>
				{/if}
				<Button
					variant="ghost"
					size="sm"
					aria-label="Forget {w.name || 'this key'}"
					onclick={() => flow.forget(w.id)}
				>
					Forget
				</Button>
			</li>
		{/each}
	</ul>
	<div class="flex flex-wrap gap-3 border-t border-border pt-4">
		<Button variant="link" size="sm" onclick={flow.startCreate}
			><Plus size={14} /> Create a new key</Button
		>
		<Button variant="link" size="sm" onclick={flow.startRestore}>Restore from a phrase</Button>
	</div>
	<p class="text-xs text-ink-dim">
		Each key is its own party. Forgetting removes the encrypted copy from this device only; the
		recovery phrase brings it back anywhere.
	</p>
</Panel>
