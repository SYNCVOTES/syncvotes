<script lang="ts">
	import { store, flow } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Plus from '@lucide/svelte/icons/plus';
	import { dateOf, label } from '$lib/format';

	/** Every key kept on this device: select another, add one, or forget one. */
	const screen = $derived(store.screen);
	let forgetting = $state<string | null>(null);
</script>

<section class="space-y-3 border-t border-border pt-6">
	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
		<h2 class="eyebrow">
			Keys on this device <span class="ml-1 text-ink-mid">{store.wallets.length}</span>
		</h2>
		<div class="flex flex-wrap gap-1">
			<Button variant="link" size="sm" class="px-2" onclick={flow.startCreate}
				><Plus size={14} /> Create key</Button
			>
			<Button variant="link" size="sm" class="px-2" onclick={flow.startRestore}>Restore key</Button>
		</div>
	</div>
	<ul class="divide-y divide-border">
		{#each store.wallets as w (w.id)}
			{@const unlocked = screen.at === 'home' && w.party === screen.who.party}
			{@const offered = screen.at === 'locked' && w.id === store.selected}
			<li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
				<div class="min-w-0 flex-1 basis-48">
					<div
						class="truncate font-mono text-sm {unlocked || offered ? 'text-orange' : 'text-ink'}"
					>
						{label(w.party)}
					</div>
					<div class="mt-0.5 flex flex-wrap gap-x-3 font-mono text-xs text-ink-dim">
						<span
							>{w.lock === 'passkey' ? 'Passkey' : 'Password'}{w.created
								? ` · ${dateOf(w.created)}`
								: ''}</span
						>
						{#if unlocked}
							<span class="flex items-center gap-1.5 text-green">
								<span class="size-1.5 rounded-full bg-green"></span> unlocked
							</span>
						{:else if offered}
							<span>selected</span>
						{/if}
					</div>
				</div>
				<div class="flex items-center gap-1">
					{#if !unlocked && !offered}
						<Button variant="outline" size="sm" onclick={() => flow.select(w.id)}>Select</Button>
					{/if}
					{#if forgetting === w.id}
						<Button variant="destructive" size="sm" onclick={() => flow.forget(w.id)}
							>Yes, forget</Button
						>
						<Button variant="ghost" size="sm" onclick={() => (forgetting = null)}>Keep</Button>
					{:else}
						<Button
							variant="ghost"
							size="sm"
							aria-label="Forget {label(w.party)}"
							onclick={() => (forgetting = w.id)}
						>
							Forget
						</Button>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
	<p class="text-xs text-ink-dim">
		Forget removes the key from this device only. Restore it anywhere with its phrase.
	</p>
</section>
