import * as remote from './api.remote';
import { toBase64, type Signer } from './wallet';
import { verifyPrepared, verifyTopology } from './verify';

/**
 * The browser's half of every ledger operation. The server prepares transactions; this file
 * checks what comes back against what was asked for (`verify.ts`), has the signer sign it and
 * sends it on. The key itself never leaves its closure in `wallet.ts`.
 */

export type Identity = { party: string; name: string };
export type Topology = Awaited<ReturnType<typeof remote.lookup>>;

/** Which party this key is, and whether it already exists on the ledger. */
export const lookup = (s: Signer): Promise<Topology> => remote.lookup(toBase64(s.publicKey));

/** Creates the party for a new key. The key signs its own topology; the server only forwards. */
export async function enrol(s: Signer, topology: Topology, name: string): Promise<Identity> {
	await verifyTopology(topology);

	const { party } = await remote.enrol({
		publicKey: toBase64(s.publicKey),
		multiHash: topology.multiHash,
		signature: s.sign(topology.multiHash),
		name
	});
	return { party, name };
}

type Prepared = { preparedTransaction: string; preparedTransactionHash: string; hashingSchemeVersion: string };

/** Verify and sign a prepared transaction here, then let the server execute it. */
async function sign(s: Signer, who: Identity, choice: string, prepared: Prepared): Promise<void> {
	await verifyPrepared(prepared, { party: who.party, choice });
	await remote.execute({
		party: who.party,
		...prepared,
		signature: s.sign(prepared.preparedTransactionHash)
	});
}

export async function createDao(
	s: Signer,
	who: Identity,
	input: { name: string; description: string; members: string[] }
): Promise<void> {
	const prepared = await remote.prepareCreateDao({ party: who.party, ...input });
	await sign(s, who, 'Account_CreateDAO', prepared);
}

export async function createProposal(
	s: Signer,
	who: Identity,
	input: { dao: string; title: string; description: string; days: number }
): Promise<void> {
	const prepared = await remote.prepareCreateProposal({ party: who.party, ...input });
	await sign(s, who, 'DAO_CreateProposal', prepared);
}

export async function vote(s: Signer, who: Identity, proposal: string, choice: 'Yes' | 'No') {
	const prepared = await remote.prepareVote({ party: who.party, proposal, vote: choice });
	await sign(s, who, 'Proposal_Vote', prepared);
}

export async function close(s: Signer, who: Identity, proposal: string) {
	const prepared = await remote.prepareClose({ party: who.party, proposal });
	await sign(s, who, 'Proposal_Close', prepared);
}
