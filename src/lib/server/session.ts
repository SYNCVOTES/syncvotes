import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { ed25519 } from '@noble/curves/ed25519.js';
import { fingerprintOf } from '$lib/verify';

/**
 * A read session: proof that whoever is asking holds the key of the party they ask for. The
 * ledger already demands a signature for every write; reads are the app's own, so the app asks
 * for one too — a signed challenge, once per unlock, kept in an HttpOnly cookie. Sessions live
 * in memory: a restart ends them, and the browser, still holding the key, simply signs again.
 */

const COOKIE = 'sv_session';
const CHALLENGE_TTL = 2 * 60 * 1000;
const SESSION_TTL = 12 * 60 * 60 * 1000;

const challenges = new Map<string, { party: string; publicKey: Uint8Array; at: number }>();
const sessions = new Map<string, { party: string; exp: number }>();

const random = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32)));

function sweep() {
	const now = Date.now();
	for (const [k, c] of challenges) if (now - c.at > CHALLENGE_TTL) challenges.delete(k);
	for (const [k, s] of sessions) if (now > s.exp) sessions.delete(k);
}

/** Bytes for the key to sign. The party must be the one this key names. */
export async function challenge(party: string, publicKey: string): Promise<string> {
	sweep();
	const key = new Uint8Array(Buffer.from(publicKey, 'base64'));
	if (party.split('::')[1] !== (await fingerprintOf(key))) {
		throw error(403, 'That key does not belong to this party');
	}
	const nonce = random().toString('base64');
	challenges.set(nonce, { party, publicKey: key, at: Date.now() });
	return nonce;
}

/** The signed challenge comes back: start a session for the party and hand the browser a cookie. */
export function start(nonce: string, signature: string): string {
	const c = challenges.get(nonce);
	challenges.delete(nonce);
	if (!c || Date.now() - c.at > CHALLENGE_TTL) throw error(400, 'Sign in again');
	const ok = ed25519.verify(
		Buffer.from(signature, 'base64'),
		Buffer.from(nonce, 'base64'),
		c.publicKey
	);
	if (!ok) throw error(403, 'The signature does not match the key');

	const token = random().toString('hex');
	sessions.set(token, { party: c.party, exp: Date.now() + SESSION_TTL });
	getRequestEvent().cookies.set(COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: SESSION_TTL / 1000
	});
	return c.party;
}

export function end(): void {
	const { cookies } = getRequestEvent();
	const token = cookies.get(COOKIE);
	if (token) sessions.delete(token);
	cookies.delete(COOKIE, { path: '/' });
}

/** The party of the current request's session, if any. */
export function party(): string | null {
	const token = getRequestEvent().cookies.get(COOKIE);
	const s = token ? sessions.get(token) : undefined;
	if (!s) return null;
	if (Date.now() > s.exp) {
		sessions.delete(token!);
		return null;
	}
	return s.party;
}

/** The session's party, or 401. With `expected`, it must be that party. */
export function required(expected?: string): string {
	const p = party();
	if (!p) throw error(401, 'Unlock your wallet to see this');
	if (expected && p !== expected) throw error(403, 'Signed in as a different party');
	return p;
}
