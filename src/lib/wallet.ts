import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';

/**
 * The user's key, and nothing else. It is derived from a recovery phrase, lives in a closure in
 * this tab's memory while unlocked, and rests encrypted in localStorage between visits. The server never
 * sees it: every transaction is prepared there, signed here, and executed there.
 *
 * Canton identifies an external party by the fingerprint of its key, so the phrase alone is
 * enough to come back to the same party from any device.
 */

/** Bytes backed by a plain ArrayBuffer — the only kind WebCrypto accepts. */
type Bytes = Uint8Array<ArrayBuffer>;

/**
 * The signing capability. The private key exists only inside the closure that made this; the
 * rest of the app can ask it to sign, ask it to encrypt itself for storage, or dispose of it —
 * never read it. After `dispose()` every method refuses, even through a handle captured earlier.
 */
export type Signer = {
	readonly publicKey: Uint8Array;
	/** Signs a base64 hash the way Canton wants an ed25519 signature: raw, concatenated, base64. */
	sign(hashBase64: string): string;
	/** Encrypts the key with an AES-GCM key for storage; the plaintext stays in the closure. */
	seal(aes: CryptoKey): Promise<{ iv: string; data: string }>;
	/** Zeroes the key. Idempotent. */
	dispose(): void;
	readonly disposed: boolean;
};

export class LockedError extends Error {
	constructor() {
		super('The wallet is locked');
	}
}

function signer(privateKey: Bytes): Signer {
	let key: Bytes | null = privateKey;
	const publicKey = ed25519.getPublicKey(privateKey);

	return {
		publicKey,
		sign(hashBase64) {
			if (!key) throw new LockedError();
			return toBase64(ed25519.sign(fromBase64(hashBase64), key));
		},
		async seal(aes) {
			if (!key) throw new LockedError();
			const iv = crypto.getRandomValues(new Uint8Array(12));
			const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, key);
			return { iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
		},
		dispose() {
			key?.fill(0);
			key = null;
		},
		get disposed() {
			return key === null;
		}
	};
}

// ---- Recovery phrase → key -------------------------------------------------------------------

/** SLIP-0044 registers 6767 for Canton Coin; the rest is the usual BIP-44 layout. */
const PATH = [44, 6767, 0, 0, 0];

export const newPhrase = () => generateMnemonic(wordlist, 128);
export const isPhrase = (phrase: string) => validateMnemonic(normalise(phrase), wordlist);

const normalise = (phrase: string) => phrase.trim().toLowerCase().split(/\s+/).join(' ');

/**
 * SLIP-0010 for ed25519, hardened steps only — the only kind the curve allows, so the path above
 * is implicitly all-hardened.
 */
export function signerFromPhrase(phrase: string): Signer {
	const seed = mnemonicToSeedSync(normalise(phrase));

	let node = hmac(sha512, new TextEncoder().encode('ed25519 seed'), seed);
	seed.fill(0);
	for (const index of PATH) {
		const data = new Uint8Array(37);
		data.set(node.subarray(0, 32), 1);
		new DataView(data.buffer).setUint32(33, (index | 0x80000000) >>> 0);
		const next = hmac(sha512, node.subarray(32), data);
		// Each step's parent key lives in `node` and `data`; neither is needed once the child exists.
		node.fill(0);
		data.fill(0);
		node = next;
	}

	const privateKey = new Uint8Array(node.subarray(0, 32));
	node.fill(0);
	return signer(privateKey);
}

// ---- Encrypted at rest --------------------------------------------------------------------

const STORE = 'syncvotes.key';

type Lock =
	{ kind: 'passkey'; credentialId: string; salt: string } | { kind: 'password'; salt: string };

type Stored = { version: 1; lock: Lock; iv: string; data: string };

export const storedLock = (): Lock['kind'] | null => {
	const stored = load();
	return stored ? stored.lock.kind : null;
};

export const forgetStoredKey = () => localStorage.removeItem(STORE);

function load(): Stored | null {
	try {
		const raw = localStorage.getItem(STORE);
		return raw ? (JSON.parse(raw) as Stored) : null;
	} catch {
		return null;
	}
}

async function store(s: Signer, lock: Lock, aes: CryptoKey): Promise<void> {
	const { iv, data } = await s.seal(aes);
	const stored: Stored = { version: 1, lock, iv, data };
	localStorage.setItem(STORE, JSON.stringify(stored));
}

async function open(stored: Stored, aes: CryptoKey): Promise<Signer> {
	const plain = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: fromBase64(stored.iv) },
		aes,
		fromBase64(stored.data)
	);
	return signer(new Uint8Array(plain));
}

// ---- Password ---------------------------------------------------------------------------

async function passwordKey(password: string, salt: Bytes): Promise<CryptoKey> {
	const material = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveKey']
	);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600_000 },
		material,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

export async function lockWithPassword(s: Signer, password: string): Promise<void> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	await store(s, { kind: 'password', salt: toBase64(salt) }, await passwordKey(password, salt));
}

export async function unlockWithPassword(password: string): Promise<Signer> {
	const stored = load();
	if (!stored || stored.lock.kind !== 'password') throw new Error('No password-locked key here');
	return open(stored, await passwordKey(password, fromBase64(stored.lock.salt)));
}

// ---- Passkey ----------------------------------------------------------------------------
//
// A passkey cannot sign a Canton transaction: WebAuthn wraps whatever it signs in its own
// structure, and Canton verifies a signature over the bare hash. But the PRF extension lets a
// passkey derive a stable secret, and that secret can guard the key that does sign. Touch ID
// then unlocks; the phrase is only for recovery.

type PrfResults = { prf?: { enabled?: boolean; results?: { first: ArrayBuffer } } };

/**
 * Whether this browser can do what the passkey path needs: a platform authenticator, and the
 * PRF extension. Newer browsers say so outright; older ones are trusted to have PRF if they
 * have a platform authenticator at all, which held for every engine that shipped it.
 */
export async function passkeysAvailable(): Promise<boolean> {
	if (typeof PublicKeyCredential === 'undefined') return false;
	const caps = (
		PublicKeyCredential as unknown as {
			getClientCapabilities?: () => Promise<Record<string, boolean>>;
		}
	).getClientCapabilities;
	if (caps) {
		const c = await caps.call(PublicKeyCredential).catch(() => null);
		if (c && 'extension:prf' in c)
			return c['extension:prf'] === true && c.userVerifyingPlatformAuthenticator !== false;
	}
	return (
		PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.().catch(() => false) ??
		false
	);
}

const PRF_INPUTS = (salt: Bytes) =>
	({ prf: { eval: { first: salt } } }) as AuthenticationExtensionsClientInputs;

const prfResult = (credential: PublicKeyCredential | null) =>
	(credential?.getClientExtensionResults() as PrfResults).prf?.results?.first;

/** The PRF secret becomes the AES key that guards the signing key. */
async function keyFromSecret(secret: ArrayBuffer, salt: Bytes): Promise<CryptoKey> {
	const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('syncvotes key') },
		material,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

/** One biometric prompt: asserts the passkey and evaluates the PRF in the same step. */
async function assertSecret(credentialId: Bytes, salt: Bytes): Promise<ArrayBuffer> {
	const assertion = (await navigator.credentials.get({
		publicKey: {
			challenge: crypto.getRandomValues(new Uint8Array(32)),
			allowCredentials: [{ id: credentialId, type: 'public-key' }],
			userVerification: 'required',
			extensions: PRF_INPUTS(salt)
		}
	})) as PublicKeyCredential | null;

	const secret = prfResult(assertion);
	if (!secret) throw new Error('This passkey cannot derive a secret (no PRF support)');
	return secret;
}

export async function lockWithPasskey(s: Signer, label: string): Promise<void> {
	// The salt goes into the creation request so the PRF is evaluated there and then — one
	// prompt. Authenticators that only evaluate on assertion return nothing here, and get asked
	// once more; that is the second prompt some devices show, not the norm.
	const salt = crypto.getRandomValues(new Uint8Array(32));

	const credential = (await navigator.credentials.create({
		publicKey: {
			challenge: crypto.getRandomValues(new Uint8Array(32)),
			rp: { name: 'SyncVotes' },
			user: { id: new Uint8Array(s.publicKey.subarray(0, 16)), name: label, displayName: label },
			pubKeyCredParams: [
				{ type: 'public-key', alg: -7 },
				{ type: 'public-key', alg: -257 }
			],
			authenticatorSelection: {
				authenticatorAttachment: 'platform',
				residentKey: 'required',
				userVerification: 'required'
			},
			extensions: PRF_INPUTS(salt)
		}
	})) as PublicKeyCredential | null;

	if (!credential) throw new Error('No passkey was created');
	if (!(credential.getClientExtensionResults() as PrfResults).prf?.enabled) {
		throw new Error('This device created a passkey without PRF support — use a password instead');
	}

	const credentialId = new Uint8Array(credential.rawId);
	const secret = prfResult(credential) ?? (await assertSecret(credentialId, salt));

	await store(
		s,
		{ kind: 'passkey', credentialId: toBase64(credentialId), salt: toBase64(salt) },
		await keyFromSecret(secret, salt)
	);
}

export async function unlockWithPasskey(): Promise<Signer> {
	const stored = load();
	if (!stored || stored.lock.kind !== 'passkey') throw new Error('No passkey-locked key here');
	const salt = fromBase64(stored.lock.salt);
	const secret = await assertSecret(fromBase64(stored.lock.credentialId), salt);
	return open(stored, await keyFromSecret(secret, salt));
}

// ---- bytes ------------------------------------------------------------------------------

export const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
export const fromBase64 = (text: string): Bytes =>
	Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
