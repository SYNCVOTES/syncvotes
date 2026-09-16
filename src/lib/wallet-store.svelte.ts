import * as wallet from './wallet';
import * as actions from './actions';
import * as session from './session';

/**
 * The one place the page keeps its wallet: which screen the onboarding is on, the signer while
 * unlocked, and who the user is. Every route reads it; the wallet page and the connect dialog
 * drive it. Runes make it reactive across components without a framework store.
 *
 * A device can hold several keys. `wallets` lists them; `selected` is the one the locked screen
 * offers to unlock, or the one that is unlocked.
 */

export type Screen =
	| { at: 'loading' }
	| { at: 'welcome' }
	| { at: 'create'; phrase: string }
	| { at: 'restore' }
	| { at: 'name'; signer: wallet.Signer; topology: actions.Topology }
	| { at: 'protect'; signer: wallet.Signer; who: actions.Identity }
	| { at: 'locked'; lock: 'passkey' | 'password' }
	| { at: 'home'; signer: wallet.Signer; who: actions.Identity };

let screen = $state<Screen>({ at: 'loading' });
let busy = $state(false);
let problem = $state<string | null>(null);
let wallets = $state<wallet.StoredWallet[]>([]);
let selected = $state<string | null>(null);

export const store = {
	get screen() {
		return screen;
	},
	get busy() {
		return busy;
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
	/** Every key kept on this device. */
	get wallets() {
		return wallets;
	},
	/** The stored key the locked screen offers, or the one in use. */
	get selected() {
		return selected;
	}
};

const refresh = () => {
	wallets = wallet.storedWallets();
};

/** Shows the locked screen for a stored key, or the welcome screen when there is none. */
function offer(id: string | null) {
	refresh();
	const found = wallets.find((w) => w.id === id) ?? wallets[0];
	selected = found?.id ?? null;
	screen = found ? { at: 'locked', lock: found.lock } : { at: 'welcome' };
}

/** Called once, in the browser: is there a key on this device? */
export function boot() {
	if (screen.at !== 'loading') return;
	offer(wallet.activeWallet());
}

const status = (error: unknown) => (error as { status?: number })?.status;

/**
 * The read session lives on the server and can be gone while the key is still here: a restart,
 * another tab locking, a cookie that expired. Signing a fresh challenge is all it takes.
 */
async function reconnect(): Promise<boolean> {
	if (screen.at !== 'home') return false;
	try {
		await actions.openSession(screen.signer, screen.who);
		return true;
	} catch {
		return false;
	}
}

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
			return;
		}
		problem = describe(error);
	} finally {
		busy = false;
	}
}

/** Remote functions rethrow server errors as HttpError; the message is in the body. */
export function describe(error: unknown): string {
	const body = (error as { body?: { message?: string } })?.body;
	if (body?.message) return body.message;
	// WebAuthn's one error for "cancelled", "timed out" and "no such passkey here".
	if (error instanceof DOMException && error.name === 'NotAllowedError') {
		return 'Touch ID was cancelled or timed out — try again';
	}
	return error instanceof Error ? error.message : String(error);
}

async function enter(signer: wallet.Signer, who: actions.Identity) {
	// The read session first, so the pages that open next are allowed to read.
	await actions.openSession(signer, who);
	screen = { at: 'home', signer, who };
	session.start(signer, lock);
}

/** A key is in hand — find out whether the ledger already knows it. */
const identify = (signer: wallet.Signer) =>
	run(async () => {
		// From here on a key is in memory, so the auto-lock is armed from here on too.
		session.start(signer, lock);
		const topology = await actions.lookup(signer);
		if (topology.exists && topology.name && topology.account) {
			screen = {
				at: 'protect',
				signer,
				who: { party: topology.partyId, name: topology.name, account: topology.account }
			};
			return;
		}
		screen = { at: 'name', signer, topology };
	});

export const flow = {
	startCreate() {
		if ('signer' in screen) screen.signer.dispose();
		session.lock();
		screen = { at: 'create', phrase: wallet.newPhrase() };
	},
	startRestore() {
		if ('signer' in screen) screen.signer.dispose();
		session.lock();
		screen = { at: 'restore' };
	},
	back: () => lock(),

	/** Offers another stored key to unlock; whatever was unlocked is locked first. */
	select(id: string) {
		if ('signer' in screen) screen.signer.dispose();
		session.lock();
		offer(id);
	},

	confirmCreate() {
		if (screen.at !== 'create') return;
		return identify(wallet.signerFromPhrase(screen.phrase));
	},

	confirmRestore(phrase: string) {
		if (!wallet.isPhrase(phrase)) {
			problem = 'That is not a valid recovery phrase';
			return;
		}
		return identify(wallet.signerFromPhrase(phrase));
	},

	confirmName(name: string) {
		if (screen.at !== 'name') return;
		const { signer, topology } = screen;
		return run(async () => {
			const who = await actions.enrol(signer, topology, name);
			screen = { at: 'protect', signer, who };
		});
	},

	protectWithPasskey() {
		if (screen.at !== 'protect') return;
		const { signer, who } = screen;
		return run(async () => {
			selected = await wallet.lockWithPasskey(signer, who);
			refresh();
			await enter(signer, who);
		});
	},

	protectWithPassword(password: string) {
		if (screen.at !== 'protect') return;
		const { signer, who } = screen;
		return run(async () => {
			selected = await wallet.lockWithPassword(signer, password, who);
			refresh();
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
			const signer =
				kind === 'passkey'
					? await wallet.unlockWithPasskey(id)
					: await wallet.unlockWithPassword(password ?? '', id);
			session.start(signer, lock);
			const topology = await actions.lookup(signer);
			if (!topology.exists || !topology.name || !topology.account) {
				screen = { at: 'name', signer, topology };
				return;
			}
			const who = { party: topology.partyId, name: topology.name, account: topology.account };
			// A key from the single-wallet version learns its name the first time it is opened.
			if (!wallets.find((w) => w.id === id)?.name) {
				wallet.describeStored(id, who);
				refresh();
			}
			await enter(signer, who);
		});
	},

	/** Removes a stored key from this device — the one offered, unless another is named. */
	forget(id?: string) {
		const target = id ?? selected;
		if (!target) return;
		wallet.forgetStoredKey(target);
		if (target === selected) lock();
		else refresh();
	},

	/** Re-signs the read session with the unlocked key; false if there is no key to sign with. */
	reconnect,

	/** Signs a ledger action with the unlocked key; the page passes what to do. */
	act(action: (signer: wallet.Signer, who: actions.Identity) => Promise<void>) {
		if (screen.at !== 'home') return Promise.resolve(false);
		const { signer, who } = screen;
		let ok = false;
		return run(async () => {
			await action(signer, who);
			ok = true;
		}).then(() => ok);
	}
};

/** Disposes whatever signer the current screen holds and shows the way back in. */
export function lock() {
	if ('signer' in screen) {
		screen.signer.dispose();
		void actions.closeSession();
	}
	session.lock();
	offer(selected);
}
