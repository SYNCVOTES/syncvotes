<script lang="ts">
	import * as wallet from '$lib/wallet';
	import { store, flow, lock } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import Problem from '$lib/components/app/problem.svelte';
	import UnlockForm from '$lib/components/app/unlock-form.svelte';
	import { dateOf } from '$lib/format';
	import Plus from '@lucide/svelte/icons/plus';
	import PartyId from '$lib/components/app/party-id.svelte';

	let phraseInput = $state('');
	let savedPhrase = $state(false);
	let nameInput = $state('');
	let password = $state('');

	const screen = $derived(store.screen);
	const selectedWallet = $derived(store.wallets.find((w) => w.id === store.selected) ?? null);
	let passkeys = $state(false);
	$effect(() => {
		wallet.passkeysAvailable().then((ok) => (passkeys = ok));
	});
</script>

<svelte:head><title>Wallet — SyncVotes</title></svelte:head>

<div class="mx-auto max-w-[760px] px-6 py-12 md:px-10">
	<PageHeader
		eyebrow="Embedded wallet"
		title="Wallet"
		description="Your key lives in this browser and signs every transaction; your party lives on this app's validator. Nothing to install, nobody holds the key but you."
	/>

	<Problem message={store.problem} />

	{#if screen.at === 'loading'}
		<!-- Whether a key is on this device is only known once the page runs. -->
		<div class="h-44 animate-pulse border border-border bg-surface"></div>
	{:else if screen.at === 'welcome'}
		<section class="space-y-5 border border-dashed border-border p-8">
			<p class="text-sm text-ink-mid">
				There is no key on this device. Create one, or bring back an existing party with its
				recovery phrase.
			</p>
			<div class="flex flex-wrap gap-3">
				<Button size="lg" onclick={flow.startCreate}>Create a new key</Button>
				<Button size="lg" variant="outline" onclick={flow.startRestore}
					>I have a recovery phrase</Button
				>
			</div>
		</section>
	{:else if screen.at === 'create'}
		<section class="space-y-5 border border-border bg-surface p-8">
			<h2 class="eyebrow">Your recovery phrase</h2>
			<p class="text-sm text-ink-mid">
				Write these twelve words down. They are the only way back to this party from another device,
				and nobody — this app included — can restore them for you.
			</p>
			<p class="border border-border bg-surface-active p-5 font-mono text-sm leading-8 select-all">
				{screen.phrase}
			</p>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" class="accent-orange" bind:checked={savedPhrase} />
				I have written it down
			</label>
			<div class="flex gap-3">
				<Button disabled={store.busy || !savedPhrase} onclick={flow.confirmCreate}>Continue</Button>
				<Button variant="ghost" onclick={flow.back}>Back</Button>
			</div>
		</section>
	{:else if screen.at === 'restore'}
		<form
			class="space-y-5 border border-border bg-surface p-8"
			onsubmit={(e) => {
				e.preventDefault();
				flow.confirmRestore(phraseInput);
			}}
		>
			<h2 class="eyebrow">Recovery phrase</h2>
			<Textarea
				rows={3}
				placeholder="twelve words, separated by spaces"
				class="font-mono"
				bind:value={phraseInput}
			/>
			<div class="flex gap-3">
				<Button type="submit" disabled={store.busy || !phraseInput.trim()}>Restore</Button>
				<Button type="button" variant="ghost" onclick={flow.back}>Back</Button>
			</div>
		</form>
	{:else if screen.at === 'name'}
		<form
			class="space-y-5 border border-border bg-surface p-8"
			onsubmit={(e) => {
				e.preventDefault();
				flow.confirmName(nameInput);
			}}
		>
			<h2 class="eyebrow">Pick a name</h2>
			<p class="text-sm text-ink-mid">
				Others add you to DAOs by this name. Your party will be
				<code class="text-xs break-all">{screen.topology.partyId}</code>
				<PartyId party={screen.topology.partyId} class="align-middle [&>span]:hidden" />
			</p>
			<div class="flex gap-3">
				<Input placeholder="e.g. alice" class="flex-1" bind:value={nameInput} />
				<Button type="submit" disabled={store.busy || nameInput.trim().length < 2}>
					{store.busy ? 'Creating party…' : 'Create party'}
				</Button>
			</div>
		</form>
	{:else if screen.at === 'protect'}
		<section class="space-y-5 border border-border bg-surface p-8">
			<h2 class="eyebrow">Keep the key on this device?</h2>
			<p class="text-sm text-ink-mid">
				It is stored encrypted, and unlocked with Touch ID or a password each visit. Without this
				you will need the recovery phrase every time.
			</p>
			{#if passkeys}
				<Button disabled={store.busy} onclick={flow.protectWithPasskey}
					>Use Touch ID / passkey</Button
				>
			{/if}
			<form
				class="flex gap-3"
				onsubmit={(e) => {
					e.preventDefault();
					flow.protectWithPassword(password);
					password = '';
				}}
			>
				<Input
					type="password"
					placeholder={passkeys ? 'or a password' : 'a password'}
					autocomplete="new-password"
					class="flex-1"
					bind:value={password}
				/>
				<Button type="submit" variant="outline" disabled={store.busy || password.length < 8}
					>Use password</Button
				>
			</form>
			<Button variant="link" size="sm" disabled={store.busy} onclick={flow.skipProtection}>
				Don't keep it, just continue this once
			</Button>
		</section>
	{:else if screen.at === 'locked'}
		<section class="space-y-5 border border-border bg-surface p-8">
			<h2 class="eyebrow">Unlock</h2>
			<p class="text-sm text-ink-mid">
				{selectedWallet?.name
					? `Unlock ${selectedWallet.name}.`
					: 'Unlock the key kept on this device.'}
			</p>
			<UnlockForm />
		</section>
		{@render sources()}
	{:else}
		<section class="space-y-6">
			<div class="border border-border bg-surface p-6">
				<div class="flex items-start justify-between gap-4">
					<div>
						<div class="eyebrow mb-2">Signed in as</div>
						<div class="font-display text-2xl font-bold">{screen.who.name}</div>
					</div>
					<span class="flex items-center gap-2 font-mono text-xs text-green">
						<span class="size-2 rounded-full bg-green"></span> unlocked
					</span>
				</div>
				<div class="mt-5">
					<div class="eyebrow mb-1">Party</div>
					<div class="flex items-start gap-2">
						<code class="block min-w-0 text-xs break-all text-ink-mid">{screen.who.party}</code>
						<PartyId party={screen.who.party} class="[&>span]:hidden" />
					</div>
				</div>
			</div>
			<div class="flex flex-wrap gap-3">
				<Button href="/my-daos">My DAOs</Button>
				<Button variant="outline" onclick={lock}>Lock</Button>
			</div>
			<p class="text-xs text-ink-dim">
				The key is disposed after fifteen quiet minutes and whenever you leave the page; the
				encrypted copy stays on this device.
			</p>
		</section>
		{@render sources()}
	{/if}
</div>

<!-- Every key kept on this device: unlock another, add one, or forget one. -->
{#snippet sources()}
	<section class="mt-6 space-y-4 border border-border bg-surface p-8">
		<div class="flex items-center justify-between">
			<h2 class="eyebrow">Wallet sources</h2>
			<span class="font-mono text-xs text-ink-dim">{store.wallets.length}</span>
		</div>
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
	</section>
{/snippet}
