import * as wallet from './wallet';
import * as actions from './actions';
import * as remote from './api.remote';
import * as autoLock from './auto-lock';
import { fingerprintOf } from './verify';

/**
 * The page's wallet, as one rune store: which screen the onboarding is on, the signer while a
 * key is in memory, and who the user is. Every route reads it; the wallet page and the unlock
 * forms drive it. A device can hold several keys: `wallets` lists them, `selected` is the one
 * the locked screen offers, or the one in use.
 */

export type Screen =
	| { at: 'loading' }
	| { at: 'welcome' }
	| { at: 'create'; phrase: string }
	| { at: 'restore' }
	| { at: 'hint'; signer: wallet.Signer; fingerprint: string }
	| {
			at: 'fund';
			signer: wallet.Signer;
			fingerprint: string;
			hint: string;
			invite: string;
			/** Whether the key is kept on this device, so the page may be left while the pay-in lands. */
			kept: boolean;
	  }
	| {
			at: 'protect';
			signer: wallet.Signer;
			who: actions.Identity;
			/** Set while the party is not made yet: the key is kept first, paid for next. */
			pending?: { hint: string; invite: string; fingerprint: string };
	  }
	| { at: 'locked'; lock: 'passkey' | 'password' }
	| { at: 'home'; signer: wallet.Signer; who: actions.Identity };

let screen = $state<Screen>({ at: 'loading' });
let busy = $state(false);
let problem = $state<string | null>(null);
/** What the key or the ledger is doing right now, while `busy`; shown by the activity pill. */
let phase = $state<string | null>(null);
let wallets = $state<wallet.StoredWallet[]>([]);
let selected = $state<string | null>(null);

/** Invite codes by key fingerprint, kept on the device until the party they were for is made. */
const INVITES = 'syncvotes.invites';
const invites = {
	all(): Record<string, string> {
		try {
			return JSON.parse(localStorage.getItem(INVITES) ?? '{}') as Record<string, string>;
		} catch {
			return {};
		}
	},
	get: (fingerprint: string) => invites.all()[fingerprint] ?? '',
	set(fingerprint: string, invite: string) {
		try {
			localStorage.setItem(INVITES, JSON.stringify({ ...invites.all(), [fingerprint]: invite }));
		} catch {
			// Not remembered: the code is asked for again after a reload.
		}
	},
	forget(fingerprint: string) {
		const rest = invites.all();
		delete rest[fingerprint];
		try {
			localStorage.setItem(INVITES, JSON.stringify(rest));
		} catch {
			// Nothing to forget.
		}
	}
};

export const store = {
	get screen() {
		return screen;
	},
	get busy() {
		return busy;
	},
	get phase() {
		return phase;
	},
	get problem() {
		return problem;
	},
	set problem(value: string | null) {
		problem = value;
	},
	/** The signed-in identity, or null while locked or absent. */
	get who(): actions.Identity | null {
		return screen.at === 'home' ? screen.who : null;
	},
	/** Whether a key exists on this device at all. */
	get hasKey() {
		return screen.at !== 'welcome' && screen.at !== 'loading';
	},
	get wallets() {
		return wallets;
	},
	get selected() {
		return selected;
	}
};

/** Names the step under way, for the activity pill. Cleared when the action ends. */
export const working = (what: string | null) => (phase = what);

/** Shows the locked screen for a stored key, or the welcome screen when there is none. */
function offer(id: string | null) {
	wallets = wallet.storedWallets();
	const found = wallets.find((w) => w.id === id) ?? wallets[0];
	selected = found?.id ?? null;
	screen = found ? { at: 'locked', lock: found.lock } : { at: 'welcome' };
}

/** Called once, in the browser: is there a key on this device? */
export function boot() {
	if (screen.at === 'loading') offer(wallet.activeWallet());
}

/** Disposes whatever signer the current screen holds and shows the way back in. */
export function lock() {
	if ('signer' in screen) {
		screen.signer.dispose();
		void actions.closeSession();
	}
	autoLock.stop();
	offer(selected);
}

/**
 * The read session lives on the server and can be gone while the key is still here: a restart,
 * another tab locking, a cookie that expired. Signing a fresh challenge is all it takes.
 */
async function reconnect(): Promise<boolean> {
	if (screen.at !== 'home') return false;
	return actions.openSession(screen.signer, screen.who).then(
		() => true,
		() => false
	);
}

const status = (error: unknown) => (error as { status?: number })?.status;

async function run(action: () => Promise<void>) {
	busy = true;
	problem = null;
	try {
		try {
			await action();
		} catch (error) {
			if (status(error) === 401 && (await reconnect())) await action();
			else throw error;
		}
	} catch (error) {
		if (error instanceof wallet.LockedError) {
			lock();
			problem = 'Wallet locked. Unlock and try again.';
		} else {
			problem = describe(error);
		}
	} finally {
		busy = false;
		phase = null;
	}
}

/**
 * Whether an error is the server being away rather than saying no: a gateway answer while the
 * app restarts (a deploy), or no answer at all. Such errors are worth retrying, quietly.
 */
export function transient(error: unknown): boolean {
	const e = error as { status?: number; body?: { message?: string }; message?: string } | null;
	if (!e || typeof e !== 'object') return false;
	if (typeof e.status === 'number') return e.status >= 502 && e.status <= 504;
	const message = e.body?.message ?? e.message ?? '';
	return (
		message === '' ||
		/failed to fetch|networkerror|load failed|network request failed|connection/i.test(message)
	);
}

/**
 * The ledger's own words for what a user can run into, said the way the app says things. The
 * Daml strings stay as they are (package lineage), and the server still reads them as they are.
 */
const PLAIN: Record<string, string> = {
	'Already voted; votes on this proposal cannot be changed':
		'You have already voted. Votes on this proposal are final.',
	'Already settled': 'This proposal is already decided.',
	'Already counted': 'This proposal is already decided.',
	'Cast after the deadline': 'Voting has closed.',
	'Joined after the vote opened': 'You have no vote on this proposal.',
	'The share changed after the vote opened': 'You have no vote on this proposal.'
};

/** Remote functions rethrow server errors as HttpError; the message is in the body. */
export function describe(error: unknown): string {
	if (transient(error)) return "Can't reach SyncVotes. Try again in a moment.";
	const body = (error as { body?: { message?: string } })?.body;
	if (body?.message) return PLAIN[body.message.trim()] ?? body.message;
	// WebAuthn's one error for "cancelled", "timed out" and "no such passkey here".
	if (error instanceof DOMException && error.name === 'NotAllowedError') {
		return 'Passkey cancelled or timed out. Try again.';
	}
	return error instanceof Error ? error.message : String(error);
}

/** The read session first, so the pages that open next are allowed to read. */
async function enter(signer: wallet.Signer, who: actions.Identity) {
	working('Signing in');
	await actions.openSession(signer, who);
	screen = { at: 'home', signer, who };
}

/** A key is in hand: does the ledger know it? A known key is signed in; a new one picks a hint. */
async function identify(signer: wallet.Signer, andThen: 'protect' | 'enter') {
	working('Finding your party');
	// A key is in memory from here on, so the auto-lock is armed from here on too.
	autoLock.start(lock);
	const found = await actions.lookup(signer);
	if (!found.exists) {
		// A key kept on this device before its party was made carries the hint it was named with:
		// the pay-in can be resumed after a reload, on the same party, with the same invite.
		const kept = wallets.find((w) => w.party.endsWith(`::${found.fingerprint}`));
		if (kept) {
			const hint = kept.party.slice(0, -found.fingerprint.length - 2);
			const invite = invites.get(found.fingerprint);
			screen = { at: 'fund', signer, fingerprint: found.fingerprint, hint, invite, kept: true };
		} else screen = { at: 'hint', signer, fingerprint: found.fingerprint };
		return;
	}
	const who = { party: found.party, account: found.account };
	if (andThen === 'protect') screen = { at: 'protect', signer, who };
	else await enter(signer, who);
}

export const flow = {
	startCreate() {
		lock();
		screen = { at: 'create', phrase: wallet.newPhrase() };
	},
	startRestore() {
		lock();
		screen = { at: 'restore' };
	},
	back: lock,

	/** Offers another stored key to unlock; whatever was unlocked is locked first. */
	select(id: string) {
		lock();
		offer(id);
	},

	/** A phrase made just now has no party anywhere: the key goes straight to naming one. */
	confirmCreate() {
		if (screen.at !== 'create') return;
		const { phrase } = screen;
		return run(async () => {
			const signer = wallet.signerFromPhrase(phrase);
			autoLock.start(lock);
			screen = { at: 'hint', signer, fingerprint: await fingerprintOf(signer.publicKey) };
		});
	},

	confirmRestore(phrase: string) {
		if (!wallet.isPhrase(phrase)) {
			problem = 'That is not a valid recovery phrase';
			return;
		}
		return run(() => identify(wallet.signerFromPhrase(phrase), 'protect'));
	},

	/**
	 * The hint is the label in the party id. Before the party is made, its cost has to have
	 * arrived for the key: the page shows where to pay and waits.
	 */
	confirmHint(hint: string, invite = '') {
		if (screen.at !== 'hint') return;
		const { signer, fingerprint } = screen;
		return run(async () => {
			// Checked before anyone pays for a party: a wrong code costs nothing.
			if (!(await remote.checkInvite(invite))) {
				throw new Error('Invalid invite code.');
			}
			// The key is kept before anyone pays for it: a reload while the pay-in lands must not
			// cost a new key. The party id is known already; it is the hint and the fingerprint.
			invites.set(fingerprint, invite);
			screen = {
				at: 'protect',
				signer,
				who: { party: `${hint}::${fingerprint}`, account: '' },
				pending: { hint, invite, fingerprint }
			};
		});
	},

	/** A later visit knows the code again; the server asks for it when the party is made. */
	setInvite(invite: string) {
		if (screen.at !== 'fund') return;
		invites.set(screen.fingerprint, invite);
		screen = { ...screen, invite };
	},

	/** What arrived covers a party: the key signs the topology that names it, and you are in. */
	enrolNow() {
		if (screen.at !== 'fund' || busy) return;
		const { signer, hint, invite, fingerprint } = screen;
		return run(async () => {
			working('Creating party');
			const topology = await actions.topology(signer, hint);
			const who = await actions.enrol(signer, hint, topology, invite);
			invites.forget(fingerprint);
			await enter(signer, who);
		});
	},

	/**
	 * Keeps the key on this device behind a passkey or a password. A party that exists is then
	 * signed in; one that is not yet is paid for next.
	 */
	protect(how: { passkey: true } | { password: string }) {
		if (screen.at !== 'protect') return;
		const { signer, who, pending } = screen;
		return run(async () => {
			working('Encrypting key');
			selected =
				'passkey' in how
					? await wallet.lockWithPasskey(signer, who.party)
					: await wallet.lockWithPassword(signer, how.password, who.party);
			wallets = wallet.storedWallets();
			if (pending) screen = { at: 'fund', signer, ...pending, kept: true };
			else await enter(signer, who);
		});
	},

	skipProtection() {
		if (screen.at !== 'protect') return;
		const { signer, who, pending } = screen;
		if (pending) {
			screen = { at: 'fund', signer, ...pending, kept: false };
			return;
		}
		return run(() => enter(signer, who));
	},

	unlock(password?: string) {
		if (screen.at !== 'locked' || !selected) return;
		const id = selected;
		const kind = screen.lock;
		return run(async () => {
			working('Unlocking');
			const signer =
				kind === 'passkey'
					? await wallet.unlockWithPasskey(id)
					: await wallet.unlockWithPassword(password ?? '', id);
			await identify(signer, 'enter');
		});
	},

	/** Removes a stored key from this device — the one offered, unless another is named. */
	forget(id?: string) {
		const target = id ?? selected;
		if (!target) return;
		wallet.forgetStoredKey(target);
		if (target === selected) lock();
		else wallets = wallet.storedWallets();
	},

	/** Re-signs the read session with the unlocked key; false if there is no key to sign with. */
	reconnect,

	/** Signs a ledger action with the unlocked key; the page passes what to do. */
	async act(action: (signer: wallet.Signer, who: actions.Identity) => Promise<void>) {
		if (screen.at !== 'home') return false;
		const { signer, who } = screen;
		let ok = false;
		await run(async () => {
			await action(signer, who);
			ok = true;
		});
		return ok;
	}
};
