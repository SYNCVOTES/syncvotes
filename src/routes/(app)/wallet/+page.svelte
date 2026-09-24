<script lang="ts">
	import * as wallet from '$lib/wallet';
	import { store, flow, lock } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import Problem from '$lib/components/problem.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import UnlockForm from '$lib/components/unlock-form.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Panel from '$lib/components/panel.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import KeyValue from '$lib/components/key-value.svelte';
	import Phrase from '$lib/components/phrase.svelte';
	import WalletSources from '$lib/components/wallet-sources.svelte';
	import ProfileForm from '$lib/components/profile-form.svelte';
	import PursePanel from '$lib/components/purse-panel.svelte';
	import * as remote from '$lib/api.remote';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { normaliseHint, hintProblem } from '$lib/hint';
	import { hintOf, label } from '$lib/format';

	let phraseInput = $state('');
	let hintInput = $state('');
	let inviteInput = $state('');
	const setup = remote.config();
	let password = $state('');

	const screen = $derived(store.screen);
	// While a party is paid for, its key's account is watched; enough arrived, the party is made.
	const funding = $derived(screen.at === 'fund' ? remote.purse(screen.fingerprint) : null);
	$effect(() => {
		const f = funding?.current;
		if (screen.at === 'fund' && f && f.credited >= f.needed && !store.busy) void flow.enrolNow();
	});
	const purse = $derived(screen.at === 'home' ? remote.myPurse(screen.who.party) : null);
	// Creating a key: the phrase is revealed on request, then one word of it is asked back.
	let revealed = $state(false);
	let checking = $state(false);
	let checkInput = $state('');
	const phraseWords = $derived(screen.at === 'create' ? screen.phrase.split(' ') : []);
	// Which word is asked is settled once per phrase, not once per keystroke.
	const checkAt = $derived.by(() => {
		const n = phraseWords.length;
		if (!n) return 0;
		let h = 0;
		for (const c of phraseWords.join(' ')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
		return h % n;
	});
	const checkOk = $derived(checkInput.trim().toLowerCase() === phraseWords[checkAt]);
	const selectedWallet = $derived(store.wallets.find((w) => w.id === store.selected) ?? null);
	const chosenHint = $derived(normaliseHint(hintInput));
	const hintIssue = $derived(hintInput.trim() ? hintProblem(chosenHint) : null);
	let passkeys = $state(false);
	$effect(() => {
		wallet.passkeysAvailable().then((ok) => (passkeys = ok));
	});
</script>

<svelte:head><title>Wallet — SyncVotes</title></svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow="Your key"
		title="Wallet"
		description="Your key lives in this browser and signs every transaction; your party lives on this app's validator, which alone confirms what you sign: while it is down, nothing of yours moves. Nothing to install, nobody holds the key but you."
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
			{#if checking}
				<h2 class="eyebrow">Check your notes</h2>
				<p class="text-sm text-ink-mid">
					Word number <strong class="text-ink">{checkAt + 1}</strong> of the twelve, as you wrote it down.
					One word, to be sure the phrase is where you can find it.
				</p>
				<form
					class="flex gap-3"
					onsubmit={(e) => {
						e.preventDefault();
						if (checkOk) flow.confirmCreate();
					}}
				>
					<Input
						placeholder="word {checkAt + 1}"
						class="flex-1 font-mono"
						autocomplete="off"
						autocapitalize="off"
						spellcheck={false}
						aria-label="Word {checkAt + 1}"
						bind:value={checkInput}
					/>
					<Button type="submit" disabled={store.busy || !checkOk}>Continue</Button>
				</form>
				{#if checkInput.trim() && !checkOk}
					<p class="font-mono text-xs text-red">
						Not word {checkAt + 1}. Look at your notes again.
					</p>
				{/if}
				<Button variant="ghost" onclick={() => (checking = false)}>Show the phrase again</Button>
			{:else}
				<h2 class="eyebrow">Your recovery phrase</h2>
				<p class="text-sm text-ink-mid">
					Write these twelve words down, in order. They are the only way back to this party from
					another device, and nobody — this app included — can restore them for you.
				</p>
				<Phrase words={screen.phrase} bind:revealed />
				<div class="flex gap-3">
					<Button
						disabled={store.busy || !revealed}
						onclick={() => {
							checkInput = '';
							checking = true;
						}}>I have written it down</Button
					>
					<Button variant="ghost" onclick={flow.back}>Back</Button>
				</div>
			{/if}
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
				flow.confirmHint(chosenHint, inviteInput.trim());
			}}
		>
			<Panel padding="lg" class="space-y-5">
				<h2 class="eyebrow">Name your party</h2>
				<p class="text-sm text-ink-mid">
					A party id is a label of your choosing, two colons, and the fingerprint of your key. The
					label is how people recognise you; the fingerprint is what makes you you. It cannot be
					changed later.
				</p>
				{#await setup then c}
					{#if c.invitesRequired}
						<div class="space-y-1">
							<Input
								placeholder="Invite code"
								class="font-mono"
								maxlength={80}
								autocomplete="off"
								bind:value={inviteInput}
							/>
							<p class="font-mono text-xs text-ink-dim">
								SyncVotes is by invitation for now. Ask whoever brought you here for a code.
							</p>
						</div>
					{/if}
				{/await}
				<div class="flex gap-3">
					<Input placeholder="e.g. alice" class="flex-1" maxlength={40} bind:value={hintInput} />
					<Button type="submit" disabled={store.busy || !hintInput.trim() || hintIssue !== null}>
						{store.busy ? 'Checking…' : 'Create party'}
					</Button>
				</div>
				<Problem message={store.problem} />
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
	{:else if screen.at === 'fund'}
		<Panel padding="lg" class="space-y-5">
			<h2 class="eyebrow">Pay for your party</h2>
			<p class="text-sm text-ink-mid">
				Your party will be <code class="break-all text-ink"
					>{screen.hint}::{screen.fingerprint}</code
				>. Creating it costs the network traffic, and nothing is created before that has arrived for
				your key. This page waits; once enough is in, the party is made and you go on.
				{#if screen.kept}
					The key is kept on this device, so you can close this page and come back later: unlocking
					it brings you here.
				{:else}
					The key exists only in this tab: leave it open until the party is made, or restore the
					phrase and pay in for the same party.
				{/if}
			</p>
			{#await setup then c}
				{#if c.invitesRequired && !screen.invite}
					<div class="space-y-1">
						<Input
							placeholder="Invite code"
							class="font-mono"
							maxlength={80}
							autocomplete="off"
							bind:value={inviteInput}
							onchange={() => flow.setInvite(inviteInput.trim())}
						/>
						<p class="font-mono text-xs text-ink-dim">
							The code this key was invited with is not on this device; enter it again.
						</p>
					</div>
				{/if}
			{/await}
			{#if funding?.error}
				<QueryError error={funding.error} refresh={() => funding?.reconnect()} />
			{:else if funding?.ready}
				<PursePanel statement={funding.current} needed={funding.current.needed} />
			{:else}
				<Skeleton height="h-40" />
			{/if}
			<Problem message={store.problem} />
			<Button variant="ghost" onclick={flow.back}>Back</Button>
		</Panel>
	{:else if screen.at === 'protect'}
		<Panel padding="lg" class="space-y-5">
			<h2 class="eyebrow">Keep the key on this device?</h2>
			<p class="text-sm text-ink-mid">
				It is stored encrypted, and unlocked with Touch ID or a password each visit. Until you
				choose, the key exists only in this tab: reloading or closing it means restoring from the
				phrase.{#if screen.pending}
					Kept here, it also lets you leave while the pay-in for your party lands.{/if}
			</p>
			{#if passkeys}
				<Button disabled={store.busy} onclick={() => flow.protect({ passkey: true })}
					>Use Touch ID / passkey</Button
				>
			{/if}
			<form
				class="flex gap-3"
				onsubmit={(e) => {
					e.preventDefault();
					flow.protect({ password });
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
				{selectedWallet
					? `Unlock ${label(selectedWallet.party)}.`
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
			{#if purse?.ready}
				<PursePanel statement={purse.current} />
			{:else if purse?.error}
				<QueryError error={purse.error} refresh={() => purse?.reconnect()} />
			{:else}
				<Skeleton height="h-40" />
			{/if}
			<Panel class="space-y-4">
				<ProfileForm party={screen.who.party} />
				<a
					href="/people/{encodeURIComponent(screen.who.party)}"
					class="inline-flex items-center gap-1 font-mono text-xs text-ink-dim transition-colors hover:text-orange"
					>See it as others do <ArrowRight size={12} /></a
				>
			</Panel>
		</section>
		<div class="mt-6"><WalletSources /></div>
	{/if}
</Page>
