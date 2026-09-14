<script lang="ts">
	import { isHttpError } from '@sveltejs/kit';
	import * as actions from '$lib/actions';
	import * as wallet from '$lib/wallet';
	import * as session from '$lib/session';
	import { partyLabel } from '$lib/parties';

	// What the page is showing. The signer is the only handle on the key, and only while unlocked.
	type Screen =
		| { at: 'loading' }
		| { at: 'welcome' }
		| { at: 'create'; phrase: string }
		| { at: 'restore' }
		| { at: 'name'; signer: wallet.Signer; topology: Awaited<ReturnType<typeof actions.lookup>> }
		| { at: 'protect'; signer: wallet.Signer; who: actions.Identity }
		| { at: 'locked'; lock: 'passkey' | 'password' }
		| { at: 'home'; signer: wallet.Signer; who: actions.Identity };

	let screen = $state<Screen>({ at: 'loading' });
	let assets = $state<actions.AssetContract[]>([]);
	let directory = $state<actions.Entry[]>([]);
	let busy = $state(false);
	let problem = $state<string | null>(null);

	// Form fields.
	let phraseInput = $state('');
	let savedPhrase = $state(false);
	let nameInput = $state('');
	let password = $state('');
	let assetName = $state('');
	let recipients = $state<Record<string, string>>({});

	$effect(() => {
		const lock = wallet.storedLock();
		screen = lock ? { at: 'locked', lock } : { at: 'welcome' };
	});

	async function run(action: () => Promise<void>) {
		busy = true;
		problem = null;
		try {
			await action();
		} catch (error) {
			if (error instanceof wallet.LockedError) {
				lock();
				return;
			}
			// Remote functions rethrow server errors as HttpError; the message is in the body.
			problem = isHttpError(error)
				? error.body.message
				: error instanceof Error
					? error.message
					: String(error);
		} finally {
			busy = false;
		}
	}

	const nameOf = (party: string) =>
		directory.find((e) => e.party === party)?.name ?? partyLabel(party);

	async function enter(signer: wallet.Signer, who: actions.Identity) {
		const listing = await actions.listAssets(who.party);
		assets = listing.assets;
		directory = listing.directory;
		screen = { at: 'home', signer, who };
		session.start(signer, lock);
	}

	// ---- Getting a key -------------------------------------------------------------------

	const startCreate = () => (screen = { at: 'create', phrase: wallet.newPhrase() });
	const startRestore = () => (screen = { at: 'restore' });

	/** A key is in hand — find out whether the ledger already knows it. */
	const identify = (signer: wallet.Signer) =>
		run(async () => {
			const topology = await actions.lookup(signer);

			if (topology.exists && topology.name) {
				const who = { party: topology.partyId, name: topology.name };
				screen = { at: 'protect', signer, who };
				return;
			}

			screen = { at: 'name', signer, topology };
		});

	const confirmCreate = () => {
		if (screen.at !== 'create') return;
		return identify(wallet.signerFromPhrase(screen.phrase));
	};

	const confirmRestore = (event: SubmitEvent) => {
		event.preventDefault();
		if (!wallet.isPhrase(phraseInput)) {
			problem = 'That is not a valid recovery phrase';
			return;
		}
		return identify(wallet.signerFromPhrase(phraseInput));
	};

	const confirmName = (event: SubmitEvent) => {
		event.preventDefault();
		if (screen.at !== 'name') return;
		const { signer, topology } = screen;

		return run(async () => {
			const who = await actions.enrol(signer, topology, nameInput);
			screen = { at: 'protect', signer, who };
		});
	};

	// ---- Keeping it on this device ------------------------------------------------------

	const protectWithPasskey = () => {
		if (screen.at !== 'protect') return;
		const { signer, who } = screen;
		return run(async () => {
			await wallet.lockWithPasskey(signer, who.name);
			await enter(signer, who);
		});
	};

	const protectWithPassword = (event: SubmitEvent) => {
		event.preventDefault();
		if (screen.at !== 'protect') return;
		const { signer, who } = screen;
		return run(async () => {
			await wallet.lockWithPassword(signer, password);
			password = '';
			await enter(signer, who);
		});
	};

	const skipProtection = () => {
		if (screen.at !== 'protect') return;
		const { signer, who } = screen;
		return run(() => enter(signer, who));
	};

	const unlock = (event?: SubmitEvent) => {
		event?.preventDefault();
		if (screen.at !== 'locked') return;
		const kind = screen.lock;

		return run(async () => {
			const signer =
				kind === 'passkey'
					? await wallet.unlockWithPasskey()
					: await wallet.unlockWithPassword(password);
			password = '';

			const topology = await actions.lookup(signer);
			if (!topology.exists || !topology.name) {
				screen = { at: 'name', signer, topology };
				return;
			}

			await enter(signer, { party: topology.partyId, name: topology.name });
		});
	};

	const forget = () => {
		wallet.forgetStoredKey();
		screen = { at: 'welcome' };
	};

	/** Disposes whatever signer the current screen holds and shows the way back in. */
	function lock() {
		if ('signer' in screen) screen.signer.dispose();
		session.lock();
		const stored = wallet.storedLock();
		assets = [];
		directory = [];
		screen = stored ? { at: 'locked', lock: stored } : { at: 'welcome' };
	}

	// ---- Using it ------------------------------------------------------------------------

	const issue = (event: SubmitEvent) => {
		event.preventDefault();
		if (screen.at !== 'home') return;
		const { signer, who } = screen;

		return run(async () => {
			await actions.issueAsset(signer, who, assetName);
			assetName = '';
			({ assets, directory } = await actions.listAssets(who.party));
		});
	};

	const give = (contractId: string) => {
		if (screen.at !== 'home') return;
		const { signer, who } = screen;
		const to = recipients[contractId]?.trim();
		if (!to) return;

		return run(async () => {
			await actions.giveAsset(signer, who, contractId, to);
			recipients[contractId] = '';
			({ assets, directory } = await actions.listAssets(who.party));
		});
	};
</script>

<main class="mx-auto max-w-2xl space-y-8 p-8">
	<header class="space-y-1">
		<h1 class="text-2xl font-bold">SyncVotes — Daml ↔ TypeScript</h1>
		<p class="text-sm text-gray-600">
			Contract types come from <code>Main.daml</code> via <code>dpm codegen-js</code>. Your party
			lives on this app's validator; your key lives in this browser and signs every transaction.
		</p>
	</header>

	{#if problem}
		<p class="rounded bg-red-50 p-4 text-sm text-red-700">{problem}</p>
	{/if}

	{#if screen.at === 'loading'}
		<p class="text-sm text-gray-500">Loading…</p>
	{:else if screen.at === 'welcome'}
		<section class="space-y-4 rounded border border-dashed p-6">
			<p class="text-sm text-gray-600">
				There is no key on this device. Create one, or bring back an existing party with its
				recovery phrase.
			</p>
			<div class="flex gap-2">
				<button class="rounded bg-blue-600 px-4 py-2 text-white" onclick={startCreate}>
					Create a new key
				</button>
				<button class="rounded border px-4 py-2" onclick={startRestore}>
					I have a recovery phrase
				</button>
			</div>
		</section>
	{:else if screen.at === 'create'}
		<section class="space-y-4 rounded border p-6">
			<h2 class="font-semibold">Your recovery phrase</h2>
			<p class="text-sm text-gray-600">
				Write these twelve words down. They are the only way back to this party from another device,
				and nobody — this app included — can restore them for you.
			</p>
			<p class="rounded bg-gray-50 p-4 font-mono text-sm leading-7 select-all">{screen.phrase}</p>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" class="rounded" bind:checked={savedPhrase} />
				I have written it down
			</label>
			<div class="flex gap-2">
				<button
					class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
					disabled={busy || !savedPhrase}
					onclick={confirmCreate}
				>
					Continue
				</button>
				<button class="rounded border px-4 py-2" onclick={lock}>Back</button>
			</div>
		</section>
	{:else if screen.at === 'restore'}
		<form class="space-y-4 rounded border p-6" onsubmit={confirmRestore}>
			<h2 class="font-semibold">Recovery phrase</h2>
			<textarea
				class="w-full rounded border-gray-300 font-mono text-sm"
				rows="3"
				placeholder="twelve words, separated by spaces"
				bind:value={phraseInput}></textarea>
			<div class="flex gap-2">
				<button
					class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
					disabled={busy || !phraseInput.trim()}
				>
					Restore
				</button>
				<button type="button" class="rounded border px-4 py-2" onclick={lock}>Back</button>
			</div>
		</form>
	{:else if screen.at === 'name'}
		<form class="space-y-4 rounded border p-6" onsubmit={confirmName}>
			<h2 class="font-semibold">Pick a name</h2>
			<p class="text-sm text-gray-600">
				Others give you things by this name. Your party will be
				<code class="break-all">{screen.topology.partyId}</code>.
			</p>
			<div class="flex gap-2">
				<input
					class="flex-1 rounded border-gray-300"
					placeholder="e.g. alice"
					bind:value={nameInput}
				/>
				<button
					class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
					disabled={busy || nameInput.trim().length < 2}
				>
					{busy ? 'Creating party…' : 'Create party'}
				</button>
			</div>
		</form>
	{:else if screen.at === 'protect'}
		<section class="space-y-4 rounded border p-6">
			<h2 class="font-semibold">Keep the key on this device?</h2>
			<p class="text-sm text-gray-600">
				It is stored encrypted, and unlocked with Touch ID or a password each visit. Without this
				you will need the recovery phrase every time.
			</p>
			{#if wallet.passkeysAvailable()}
				<button
					class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
					disabled={busy}
					onclick={protectWithPasskey}
				>
					Use Touch ID / passkey
				</button>
			{/if}
			<form class="flex gap-2" onsubmit={protectWithPassword}>
				<input
					type="password"
					class="flex-1 rounded border-gray-300"
					placeholder="or a password"
					autocomplete="new-password"
					bind:value={password}
				/>
				<button
					class="rounded border px-4 py-2 disabled:opacity-50"
					disabled={busy || password.length < 8}
				>
					Use password
				</button>
			</form>
			<button class="text-xs text-gray-500 underline" disabled={busy} onclick={skipProtection}>
				Don't keep it, just continue this once
			</button>
		</section>
	{:else if screen.at === 'locked'}
		<form class="space-y-4 rounded border p-6" onsubmit={unlock}>
			<h2 class="font-semibold">Unlock</h2>
			{#if screen.lock === 'passkey'}
				<button
					type="button"
					class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
					disabled={busy}
					onclick={() => unlock()}
				>
					Unlock with Touch ID / passkey
				</button>
			{:else}
				<div class="flex gap-2">
					<input
						type="password"
						class="flex-1 rounded border-gray-300"
						placeholder="password"
						autocomplete="current-password"
						bind:value={password}
					/>
					<button
						class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
						disabled={busy || !password}
					>
						Unlock
					</button>
				</div>
			{/if}
			<button type="button" class="text-xs text-gray-500 underline" onclick={forget}>
				Forget the key on this device
			</button>
		</form>
	{:else}
		{@const me = screen.who.party}
		<section class="flex items-start justify-between gap-4">
			<div>
				<h2 class="font-semibold">{screen.who.name}</h2>
				<p class="font-mono text-xs break-all text-gray-500">{screen.who.party}</p>
			</div>
			<button class="text-xs text-gray-500 underline" onclick={lock}>Lock</button>
		</section>

		<form class="flex gap-2" onsubmit={issue}>
			<input
				class="flex-1 rounded border-gray-300"
				placeholder="Asset name, e.g. Guitar"
				bind:value={assetName}
			/>
			<button
				class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
				disabled={busy || !assetName.trim()}
			>
				{busy ? 'Signing…' : 'Issue'}
			</button>
		</form>

		<section class="space-y-2">
			<h2 class="font-semibold">Your contracts</h2>
			{#if assets.length === 0}
				<p class="text-sm text-gray-500">Nothing yet. Issue an asset above.</p>
			{:else}
				<ul class="divide-y rounded border">
					{#each assets as asset (asset.contractId)}
						<li class="flex flex-wrap items-center justify-between gap-3 p-3">
							<div>
								<p class="font-medium">{asset.payload.name}</p>
								<p class="text-xs text-gray-500">
									owner: {nameOf(asset.payload.owner)} · issuer: {nameOf(asset.payload.issuer)}
								</p>
							</div>
							{#if asset.payload.owner === me}
								<div class="flex gap-1">
									<input
										class="w-40 rounded border-gray-300 text-sm"
										placeholder="give to…"
										list="directory"
										bind:value={recipients[asset.contractId]}
									/>
									<button
										type="button"
										class="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
										disabled={busy || !recipients[asset.contractId]?.trim()}
										onclick={() => give(asset.contractId)}
									>
										Give
									</button>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<datalist id="directory">
			{#each directory.filter((e) => e.party !== me) as entry (entry.party)}
				<option value={entry.name}></option>
			{/each}
		</datalist>
	{/if}
</main>
