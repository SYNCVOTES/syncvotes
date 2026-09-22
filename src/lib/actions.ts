import * as remote from './api.remote';
import { toBase64, type Signer } from './wallet';
import { verifyPrepared, verifyTopology, type Expected, type Plain } from './verify';
import { working } from './wallet-store.svelte';

/**
 * The browser's half of every ledger write. The server prepares a transaction; this file says
 * what the user meant, checks the prepared bytes against that (`verify.ts`), has the signer
 * sign the hash and sends the signature back. The key itself never leaves `wallet.ts`.
 */

export type Identity = { party: string; account: string };
type Lookup = Awaited<ReturnType<typeof remote.lookup>>;
export type Topology = Awaited<ReturnType<typeof remote.topology>>;
export type Prepared = {
	preparedTransaction: string;
	preparedTransactionHash: string;
	hashingSchemeVersion: string;
};
/** What a signed write is expected to do, minus the party, which is always the signer's. */
export type Intent = Omit<Expected, 'party'>;
export type Progress = (done: number, total: number) => void;

/** The parties and prices the browser checks against; asked once. */
let config: Promise<Awaited<ReturnType<typeof remote.config>>> | undefined;
export const configuration = () => (config ??= remote.config());

/** Whether the ledger already knows this key. */
export const lookup = (s: Signer): Promise<Lookup> => remote.lookup(toBase64(s.publicKey));

/** What creating the party under `hint` would sign. */
export const topology = (s: Signer, hint: string): Promise<Topology> =>
	remote.topology({ publicKey: toBase64(s.publicKey), hint });

/** Creates the party for a new key. The key signs its own topology; the server only forwards. */
export async function enrol(s: Signer, hint: string, topology: Topology): Promise<Identity> {
	working('Checking the party the ledger would create');
	await verifyTopology(topology, s.publicKey, hint);
	working('Signing the party into existence');
	return remote.enrol({
		publicKey: toBase64(s.publicKey),
		hint,
		multiHash: topology.multiHash,
		signature: s.sign(topology.multiHash)
	});
}

/** Proves to the server that this key is the party's, so its reads open up. Once per unlock. */
export async function openSession(s: Signer, who: Identity): Promise<void> {
	const nonce = await remote.sessionChallenge({
		party: who.party,
		publicKey: toBase64(s.publicKey)
	});
	await remote.sessionStart({ nonce, signature: s.sign(nonce) });
}

export const closeSession = () => remote.sessionEnd().catch(() => {});

/** Signs a prepared transaction, once it is verified to do exactly what `intent` says. */
export async function sign(s: Signer, who: Identity, intent: Intent, prepared: Prepared) {
	working('Checking what you are about to sign');
	await verifyPrepared(prepared, { party: who.party, ...intent });
	working('Signing with your key');
	const signature = s.sign(prepared.preparedTransactionHash);
	working('Waiting for the ledger to confirm');
	await remote.execute({ ...prepared, signature });
}

/** Said before every prepare: the server is building the transaction. */
const preparing = () => working('Preparing the transaction');

// ---- Proposals ----------------------------------------------------------------------------

export type Choice = 'Yes' | 'No' | 'Abstain';

/**
 * A ballot is cast from the voter's own membership contract, which the proposal page names
 * along with the deadline it shows — what the page knows already is not fetched again, since
 * every round trip is felt.
 */
export async function vote(
	s: Signer,
	who: Identity,
	proposalId: string,
	choice: Choice,
	membership: string,
	closesAt: string
) {
	preparing();
	const prepared = await remote.prepareVote({ proposal: proposalId, vote: choice });
	const intent = {
		choice: 'Member_Vote',
		contractId: membership,
		args: { proposalId, closesAt, vote: choice }
	};
	await sign(s, who, intent, prepared);
}
