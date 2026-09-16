<script lang="ts">
	import * as wallet from '$lib/wallet';
	import { store, flow, lock } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import Problem from '$lib/components/problem.svelte';
	import UnlockForm from '$lib/components/unlock-form.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Panel from '$lib/components/panel.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import KeyValue from '$lib/components/key-value.svelte';
	import Phrase from '$lib/components/phrase.svelte';
	import WalletSources from '$lib/components/wallet-sources.svelte';
	import { normaliseName, nameProblem } from '$lib/names';
	import { hintOf } from '$lib/format';

	let phraseInput = $state('');
	let savedPhrase = $state(false);
	let hintInput = $state('');
	let password = $state('');

	const screen = $derived(store.screen);
	const selectedWallet = $derived(store.wallets.find((w) => w.id === store.selected) ?? null);
	const chosenHint = $derived(normaliseName(hintInput));
	const hintIssue = $derived(hintInput.trim() ? nameProblem(chosenHint) : null);
	let passkeys = $state(false);
	$effect(() => {
		wallet.passkeysAvailable().then((ok) => (passkeys = ok));
	});
</script>

<svelte:head><title>Wallet — SyncVotes</title></svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow="Embedded wallet"
		title="Wallet"
		description="Your key lives in this browser and signs every transaction; your party lives on this app's validator. Nothing to install, nobody holds the key but you."
	/>

	<Problem message={store.problem} />

	{#if screen.at === 'loading'}
		<!-- Whether a key is on this device is only known once the page runs. -->
		<Skeleton height="h-44" />
	{:else if screen.at === 'welcome'}
		<Panel variant="dashed" padding="lg" class="space-y-5">
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
		</Panel>
	{:else if screen.at === 'create'}
		<Panel padding="lg" class="space-y-5">
			<h2 class="eyebrow">Your recovery phrase</h2>
			<p class="text-sm text-ink-mid">
				Write these twelve words down. They are the only way back to this party from another device,
				and nobody — this app included — can restore them for you.
			</p>
			<Phrase words={screen.phrase} />
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" class="accent-orange" bind:checked={savedPhrase} />
				I have written it down
			</label>
			<div class="flex gap-3">
				<Button disabled={store.busy || !savedPhrase} onclick={flow.confirmCreate}>Continue</Button>
				<Button variant="ghost" onclick={flow.back}>Back</Button>
			</div>
		</Panel>
	{:else if screen.at === 'restore'}
		<form
			onsubmit={(e) => {
				e.preventDefault();
				flow.confirmRestore(phraseInput);
			}}
		>
			<Panel padding="lg" class="space-y-5">
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
			</Panel>
		</form>
	{:else if screen.at === 'hint'}
		<form
			onsubmit={(e) => {
				e.preventDefault();
				flow.confirmHint(chosenHint);
			}}
		>
			<Panel padding="lg" class="space-y-5">
				<h2 class="eyebrow">Name your party</h2>
				<p class="text-sm text-ink-mid">
					A party id is a label of your choosing, two colons, and the fingerprint of your key. The
					label is how people recognise you; the fingerprint is what makes you you. It cannot be
					changed later.
				</p>
				<div class="flex gap-3">
					<Input placeholder="e.g. alice" class="flex-1" maxlength={40} bind:value={hintInput} />
					<Button type="submit" disabled={store.busy || !hintInput.trim() || hintIssue !== null}>
						{store.busy ? 'Creating party…' : 'Create party'}
					</Button>
				</div>
				{#if hintInput.trim()}
					<p class="font-mono text-xs {hintIssue ? 'text-red' : 'text-ink-dim'}">
						{#if hintIssue}{hintIssue}{:else}
							Your party will be
							<code class="break-all text-ink">{chosenHint}::{screen.fingerprint}</code>
						{/if}
					</p>
				{/if}
			</Panel>
		</form>
	{:else if screen.at === 'protect'}
		<Panel padding="lg" class="space-y-5">
			<h2 class="eyebrow">Keep the key on this device?</h2>
			<p class="text-sm text-ink-mid">
				It is stored encrypted, and unlocked with Touch ID or a password each visit. Until you
				choose, the key exists only in this tab: reloading or closing it means restoring from the
				phrase.
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
		</Panel>
	{:else if screen.at === 'locked'}
		<Panel padding="lg" class="space-y-5">
			<h2 class="eyebrow">Unlock</h2>
			<p class="text-sm text-ink-mid">
				{selectedWallet?.name
					? `Unlock ${selectedWallet.name}.`
					: 'Unlock the key kept on this device.'}
			</p>
			<UnlockForm />
		</Panel>
		<div class="mt-6"><WalletSources /></div>
	{:else}
		<section class="space-y-6">
			<Panel>
				<div class="flex items-start justify-between gap-4">
					<KeyValue label="Signed in as">
						<div class="font-display text-2xl font-bold">{hintOf(screen.who.party)}</div>
					</KeyValue>
					<span class="flex items-center gap-2 font-mono text-xs text-green">
						<span class="size-2 rounded-full bg-green"></span> unlocked
					</span>
				</div>
				<KeyValue label="Party" class="mt-5">
					<div class="flex items-start gap-2">
						<code class="block min-w-0 text-xs break-all text-ink-mid">{screen.who.party}</code>
						<PartyId party={screen.who.party} class="[&>span]:hidden" />
					</div>
				</KeyValue>
			</Panel>
			<div class="flex flex-wrap gap-3">
				<Button href="/my-daos">My DAOs</Button>
				<Button variant="outline" onclick={lock}>Lock</Button>
			</div>
			<p class="text-xs text-ink-dim">
				The key is disposed after fifteen quiet minutes and whenever you leave the page; the
				encrypted copy stays on this device.
			</p>
		</section>
		<div class="mt-6"><WalletSources /></div>
	{/if}
</Page>
