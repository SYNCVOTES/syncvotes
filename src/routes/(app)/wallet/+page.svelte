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
	import Hint from '$lib/components/hint.svelte';
	import Avatar from '$lib/components/avatar.svelte';
	import Phrase from '$lib/components/phrase.svelte';
	import WalletSources from '$lib/components/wallet-sources.svelte';
	import ProfileForm from '$lib/components/profile-form.svelte';
	import PursePanel from '$lib/components/purse-panel.svelte';
	import * as remote from '$lib/api.remote';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { normaliseHint, hintProblem } from '$lib/hint';
	import { hintOf, label, coin } from '$lib/format';

	let phraseInput = $state('');
	let hintInput = $state('');
	let inviteInput = $state('');
	const setup = remote.config();
	let password = $state('');
	// Said on the welcome, so the cost of a party is no surprise three steps later.
	const cost = remote.partyCost();

	const screen = $derived(store.screen);
	// While a party is paid for, its key's account is watched; enough arrived, the party is made.
	const funding = $derived(screen.at === 'fund' ? remote.purse(screen.fingerprint) : null);
	// Tried once per key, amount and code: a refusal is shown and waits for something to change,
	// rather than being retried every time the page settles.
	let tried = '';
	$effect(() => {
		const f = funding?.current;
		if (screen.at !== 'fund' || !f || f.credited < f.needed || store.busy) return;
		// Where invites are required and the code was lost to a reload, wait for it to be typed.
		if (setup.current?.invitesRequired && !screen.invite) return;
		const attempt = `${screen.fingerprint}:${f.credited}:${screen.invite}`;
		if (attempt === tried) return;
		tried = attempt;
		void flow.enrolNow();
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
	// The five steps of making a key, and which one this is; none while restoring or signed in.
	const STEPS = ['Phrase', 'Check', 'Party hint', 'Keep', 'Top up'];
	const step = $derived(
		screen.at === 'create'
			? checking
				? 2
				: 1
			: screen.at === 'hint'
				? 3
				: screen.at === 'protect' && screen.pending
					? 4
					: screen.at === 'fund'
						? 5
						: 0
	);
	// Signed in: the profile shows in the identity block; the form opens in place.
	const profile = $derived(screen.at === 'home' ? remote.profile(screen.who.party) : null);
	let editing = $state(false);
	let restoreBox = $state<HTMLTextAreaElement | null>(null);
	$effect(() => {
		if (screen.at === 'restore') restoreBox?.focus();
	});
	let passkeys = $state(false);
	$effect(() => {
		wallet.passkeysAvailable().then((ok) => (passkeys = ok));
	});
	// Whatever was typed on one screen is gone when it is left: a recovery phrase above all.
	let shownAt = '';
	$effect(() => {
		if (screen.at === shownAt) return;
		shownAt = screen.at;
		phraseInput = '';
		hintInput = '';
		inviteInput = '';
		password = '';
		checkInput = '';
		revealed = false;
		checking = false;
		editing = false;
	});
</script>

<svelte:head><title>Wallet — SyncVotes</title></svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow="Your key"
		title="Wallet"
		description={screen.at === 'welcome'
			? 'Your key stays in this browser. Only you can sign for your party.'
			: undefined}
	/>

	{#if step}
		<ol
			class="mb-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-label tracking-[0.14em] uppercase"
		>
			{#each STEPS as s, i (s)}
				<li
					class={i + 1 === step ? 'text-orange' : i + 1 < step ? 'text-ink-mid' : 'text-ink-dim'}
					aria-current={i + 1 === step ? 'step' : undefined}
				>
					{i + 1}
					{s}
				</li>
			{/each}
		</ol>
	{/if}

	{#if screen.at !== 'hint' && screen.at !== 'fund'}<Problem message={store.problem} />{/if}

	{#if screen.at === 'loading'}
		<!-- Whether a key is on this device is only known once the page runs. -->
		<Skeleton height="h-44" />
	{:else if screen.at === 'welcome'}
		<Panel variant="dashed" padding="lg" class="space-y-5">
			<p class="text-sm text-ink-mid">
				No key on this device. Create one, or restore one from its recovery phrase.
			</p>
			<div class="flex flex-wrap gap-3">
				<Button onclick={flow.startCreate}>Create key</Button>
				<Button variant="outline" onclick={flow.startRestore}>Restore key</Button>
			</div>
			{#await cost then c}
				<p class="font-mono text-xs text-ink-dim">
					Creating a party costs about {coin(c)} in network traffic. You top up before it is created.
				</p>
			{/await}
		</Panel>
	{:else if screen.at === 'create'}
		<Panel class="space-y-5">
			{#if checking}
				<h2 class="eyebrow">Confirm phrase</h2>
				<p class="text-sm text-ink-mid">
					Enter word <strong class="text-ink">{checkAt + 1}</strong> from your phrase.
				</p>
				<form
					class="flex flex-wrap gap-3"
					onsubmit={(e) => {
						e.preventDefault();
						if (checkOk) flow.confirmCreate();
					}}
				>
					<Input
						placeholder="word {checkAt + 1}"
						class="min-w-40 flex-1 font-mono"
						autocomplete="off"
						autocapitalize="off"
						spellcheck={false}
						aria-label="Word {checkAt + 1}"
						bind:value={checkInput}
					/>
					<Button type="submit" disabled={store.busy || !checkOk}>Continue</Button>
				</form>
				{#if checkInput.trim() && !checkOk}
					<p class="font-mono text-xs text-red">That is not word {checkAt + 1}.</p>
				{/if}
				<Button variant="ghost" onclick={() => (checking = false)}>Show phrase</Button>
			{:else}
				<h2 class="eyebrow">Your recovery phrase</h2>
				<p class="text-sm text-ink-mid">
					Write down these 12 words in order. They are the only way to restore this key. Nobody,
					including SyncVotes, can recover them.
				</p>
				<Phrase words={screen.phrase} bind:revealed />
				<div class="flex flex-wrap gap-3">
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
			<Panel class="space-y-5">
				<h2 class="eyebrow">Recovery phrase</h2>
				<Textarea
					rows={3}
					placeholder="twelve words, separated by spaces"
					class="font-mono"
					aria-label="Recovery phrase"
					bind:ref={restoreBox}
					bind:value={phraseInput}
				/>
				<div class="flex flex-wrap gap-3">
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
			<Panel class="space-y-5">
				<h2 class="eyebrow flex items-center gap-1.5">
					Choose a party hint <Hint
						text="Party ID = hint::fingerprint. Others see the hint; the fingerprint ties the ID to your key."
					/>
				</h2>
				<p class="text-sm text-ink-mid">
					Your party ID is this hint plus your key's fingerprint. It can't be changed later.
				</p>
				<div class="space-y-2">
					<Input
						placeholder="e.g. alice"
						maxlength={40}
						aria-label="Party hint"
						bind:value={hintInput}
					/>
					{#if hintInput.trim()}
						<p class="font-mono text-xs {hintIssue ? 'text-red' : 'text-ink-dim'}">
							{#if hintIssue}{hintIssue}{:else}
								Party ID:
								<code class="break-all text-ink">{chosenHint}::{screen.fingerprint}</code>
							{/if}
						</p>
					{/if}
				</div>
				{#await setup then c}
					{#if c.invitesRequired}
						<div class="flex items-center gap-2">
							<Input
								placeholder="Invite code"
								class="font-mono"
								maxlength={80}
								autocomplete="off"
								bind:value={inviteInput}
							/>
							<Hint text="Invite only. Ask a member for a code." align="end" />
						</div>
					{/if}
				{/await}
				<Problem message={store.problem} />
				<Button
					type="submit"
					disabled={store.busy || !setup.current || !hintInput.trim() || hintIssue !== null}
				>
					{store.busy ? 'Checking…' : 'Continue'}
				</Button>
			</Panel>
		</form>
	{:else if screen.at === 'fund'}
		<Panel class="space-y-5">
			<h2 class="eyebrow">Pay for your party</h2>
			<p class="text-sm text-ink-mid">
				Creating party <code class="break-all text-ink">{screen.hint}::{screen.fingerprint}</code>
				costs network traffic. Top up the amount below; the party is created as soon as it arrives.
				{screen.kept
					? 'You can close this page and come back.'
					: 'Keep this tab open until the party is created.'}
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
						<p class="font-mono text-xs text-ink-dim">Enter your invite code again.</p>
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
		<Panel class="space-y-5">
			<h2 class="eyebrow">Keep the key on this device?</h2>
			<p class="text-sm text-ink-mid">
				The key is stored encrypted and unlocked with a passkey or password. If you don't keep it,
				closing this tab means restoring from the phrase.
			</p>
			{#if passkeys}
				<Button disabled={store.busy} onclick={() => flow.protect({ passkey: true })}
					>Use passkey</Button
				>
			{/if}
			<form
				class="flex flex-wrap gap-3"
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
					class="min-w-40 flex-1"
					bind:value={password}
				/>
				<Button type="submit" variant="outline" disabled={store.busy || password.length < 8}
					>Use password</Button
				>
			</form>
			<Button
				variant="link"
				size="sm"
				class="px-0"
				disabled={store.busy}
				onclick={flow.skipProtection}
			>
				Skip
			</Button>
		</Panel>
	{:else if screen.at === 'locked'}
		<Panel class="space-y-5">
			<h2 class="eyebrow">
				{selectedWallet ? `Unlock ${label(selectedWallet.party)}` : 'Unlock the key on this device'}
			</h2>
			<UnlockForm />
		</Panel>
		<div class="mt-8"><WalletSources /></div>
	{:else}
		{@const p = profile?.current}
		{@const named = p?.exists ? p.name : null}
		<section class="space-y-8">
			<Panel>
				<div class="flex items-start gap-4">
					<Avatar
						who={{
							party: screen.who.party,
							name: named,
							avatar: p?.exists ? p.avatar : null
						}}
						size="md"
					/>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
							<KeyValue label="Signed in as" class="min-w-0">
								<div class="title truncate text-2xl">{named ?? hintOf(screen.who.party)}</div>
							</KeyValue>
							<div class="flex items-center gap-3">
								<span class="flex items-center gap-2 font-mono text-xs text-green">
									<span class="size-2 rounded-full bg-green"></span> unlocked
								</span>
								<Button variant="outline" size="sm" onclick={lock}>Lock</Button>
								<Hint text="Locks after 15 minutes idle or when you leave the page." align="end" />
							</div>
						</div>
						<KeyValue label="Party ID" class="mt-4">
							<div class="flex items-start gap-2">
								<code class="block min-w-0 text-xs break-all text-ink-mid">{screen.who.party}</code>
								<PartyId party={screen.who.party} class="[&>span]:hidden" />
							</div>
						</KeyValue>
						{#if !editing}
							<div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
								{#if profile?.ready}
									<Button variant="outline" size="sm" onclick={() => (editing = true)}
										>{p?.exists ? 'Edit profile' : 'Set up profile'}</Button
									>
								{/if}
								<a
									href="/people/{encodeURIComponent(screen.who.party)}"
									class="inline-flex items-center gap-1 font-mono text-xs text-ink-dim transition-colors hover:text-orange"
									>View public profile <ArrowRight size={12} /></a
								>
							</div>
							{#if profile?.ready && !p?.exists}
								<p class="mt-2 text-xs text-ink-dim">
									No display name yet. Optional; shown next to your party ID.
								</p>
							{/if}
						{/if}
					</div>
				</div>
				{#if editing}
					<div class="mt-6 border-t border-border pt-6">
						<ProfileForm party={screen.who.party} bind:open={editing} />
					</div>
				{/if}
			</Panel>
			{#if purse?.ready}
				<PursePanel statement={purse.current} />
			{:else if purse?.error}
				<QueryError error={purse.error} refresh={() => purse?.reconnect()} />
			{:else}
				<Skeleton height="h-24" />
			{/if}
			<WalletSources />
		</section>
	{/if}
</Page>
