import * as remote from './api.remote';
import { toBase64, type Signer } from './wallet';
import { verifyPrepared, verifyTopology, type Expected } from './verify';
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

/** Whether the ledger already knows this key. */
export const lookup = (s: Signer): Promise<Lookup> => remote.lookup(toBase64(s.publicKey));

/** What creating the party under `hint` would sign. */
export const topology = (s: Signer, hint: string): Promise<Topology> =>
	remote.topology({ publicKey: toBase64(s.publicKey), hint });

/** Creates the party for a new key. The key signs its own topology; the server only forwards. */
export async function enrol(
	s: Signer,
	hint: string,
	topology: Topology,
	invite = ''
): Promise<Identity> {
	working('Verifying party');
	await verifyTopology(topology, s.publicKey, hint);
	working('Creating party');
	return remote.enrol({
		publicKey: toBase64(s.publicKey),
		hint,
		multiHash: topology.multiHash,
		signature: s.sign(topology.multiHash),
		invite
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
	working('Verifying transaction');
	await verifyPrepared(prepared, { party: who.party, ...intent });
	working('Signing');
	const signature = s.sign(prepared.preparedTransactionHash);
	working('Waiting for confirmation');
	await remote.execute({ ...prepared, signature });
}

/** Said before every prepare: the server is building the transaction. */
const preparing = () => working('Preparing transaction');

// ---- Proposals ----------------------------------------------------------------------------

/** Yes, no, abstain — or `Pick:<n>` on a choice among options, `PickMany:<n>,<m>` on one that takes several. */
export type Choice = 'Yes' | 'No' | 'Abstain' | `Pick:${number}` | `PickMany:${string}`;

/**
 * A ballot is cast from the voter's own membership contract, which the proposal page names
 * along with the deadline and rule it shows — what the page knows already is not fetched
 * again, since every round trip is felt. Where votes may change, the ballot being replaced is
 * handed in.
 */
export async function vote(
	s: Signer,
	who: Identity,
	proposalId: string,
	choice: Choice,
	membership: string,
	closesAt: string,
	changeable: boolean,
	previous: string | null
) {
	preparing();
	const prepared = await remote.prepareVote({ proposal: proposalId, vote: choice });
	// A vote is a variant on the ledger (one constructor carries the option picked).
	const vote = choice.startsWith('Pick:')
		? { tag: 'Pick', value: choice.slice(5) }
		: choice.startsWith('PickMany:')
			? { tag: 'PickMany', value: choice.slice(9).split(',') }
			: { tag: choice, value: {} };
	// The ballot handed in is the one this page knows to be ours, whichever kind it is.
	if ((prepared.previous ?? prepared.previousV1) !== previous) {
		throw new Error('The ballot to replace is not the one on record. Reload and try again.');
	}
	const intent = {
		choice: 'Member_Cast',
		contractId: membership,
		args: {
			proposalId,
			closesAt,
			changeable,
			vote,
			previous: prepared.previous,
			previousV1: prepared.previousV1,
			// The provider's featured app right, known to the server only; it records a marker.
			featuredAppRight: prepared.featuredAppRight
		}
	};
	await sign(s, who, intent, prepared);
}
