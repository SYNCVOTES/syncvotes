import * as wallet from './wallet';
import * as actions from './actions';
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
	| { at: 'fund'; signer: wallet.Signer; fingerprint: string; hint: string }
	| { at: 'protect'; signer: wallet.Signer; who: actions.Identity }
	| { at: 'locked'; lock: 'passkey' | 'password' }
	| { at: 'home'; signer: wallet.Signer; who: actions.Identity };

let screen = $state<Screen>({ at: 'loading' });
let busy = $state(false);
let problem = $state<string | null>(null);
/** What the key or the ledger is doing right now, while `busy`; shown by the activity pill. */
let phase = $state<string | null>(null);
let wallets = $state<wallet.StoredWallet[]>([]);
let selected = $state<string | null>(null);

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
			problem = 'The wallet locked itself — unlock and try again';
		} else {
			problem = describe(error);
		}
	} finally {
		busy = false;
		phase = null;
	}
}

/** Remote functions rethrow server errors as HttpError; the message is in the body. */
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

export function describe(error: unknown): string {
	if (transient(error)) return 'The app is being updated or is out of reach — back in a moment';
	const body = (error as { body?: { message?: string } })?.body;
	if (body?.message) return body.message;
	// WebAuthn's one error for "cancelled", "timed out" and "no such passkey here".
	if (error instanceof DOMException && error.name === 'NotAllowedError') {
		return 'Touch ID was cancelled or timed out — try again';
	}
	return error instanceof Error ? error.message : String(error);
}

/** The read session first, so the pages that open next are allowed to read. */
async function enter(signer: wallet.Signer, who: actions.Identity) {
	working('Opening your session');
	await actions.openSession(signer, who);
	screen = { at: 'home', signer, who };
}

/** A key is in hand: does the ledger know it? A known key is signed in; a new one picks a hint. */
async function identify(signer: wallet.Signer, andThen: 'protect' | 'enter') {
	working('Looking your party up');
	// A key is in memory from here on, so the auto-lock is armed from here on too.
	autoLock.start(lock);
	const found = await actions.lookup(signer);
	if (!found.exists) {
		screen = { at: 'hint', signer, fingerprint: found.fingerprint };
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
	confirmHint(hint: string) {
		if (screen.at !== 'hint') return;
		const { signer, fingerprint } = screen;
		screen = { at: 'fund', signer, fingerprint, hint };
	},

	/** What arrived covers a party: the key signs the topology that names it. */
	enrolNow() {
		if (screen.at !== 'fund' || busy) return;
		const { signer, hint } = screen;
		return run(async () => {
			working('Creating your party on the ledger');
			const topology = await actions.topology(signer, hint);
			const who = await actions.enrol(signer, hint, topology);
			screen = { at: 'protect', signer, who };
		});
	},

	/** Keeps the key on this device behind a passkey or a password, then signs in. */
	protect(how: { passkey: true } | { password: string }) {
		if (screen.at !== 'protect') return;
		const { signer, who } = screen;
		return run(async () => {
			working('Encrypting the key on this device');
			selected =
				'passkey' in how
					? await wallet.lockWithPasskey(signer, who.party)
					: await wallet.lockWithPassword(signer, how.password, who.party);
			wallets = wallet.storedWallets();
			await enter(signer, who);
		});
	},

	skipProtection() {
		if (screen.at !== 'protect') return;
		const { signer, who } = screen;
		return run(() => enter(signer, who));
	},

	unlock(password?: string) {
		if (screen.at !== 'locked' || !selected) return;
		const id = selected;
		const kind = screen.lock;
		return run(async () => {
			working('Unlocking your key');
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
