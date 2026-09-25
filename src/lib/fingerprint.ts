// Canton's hash purpose for a public key's fingerprint, as the SDK's `keys.fingerprint`.
const PUBLIC_KEY_FINGERPRINT = 12;

/** Canton's fingerprint of a public key: a multihash of a purpose-prefixed SHA-256. */
export async function fingerprintOf(publicKey: Uint8Array): Promise<string> {
	const input = new Uint8Array(4 + publicKey.length);
	input[3] = PUBLIC_KEY_FINGERPRINT;
	input.set(publicKey, 4);
	const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
	return '1220' + [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
}
