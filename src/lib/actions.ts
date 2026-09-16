import * as remote from './api.remote';
import { toBase64, type Signer } from './wallet';
import { verifyPrepared, verifyTopology, type Plain } from './verify';
import { PARTY_HINT } from './party';

/**
 * The browser's half of every ledger operation. The server prepares transactions; this file
 * decides what the user meant, checks what comes back against that (`verify.ts`), has the
 * signer sign it and sends it on. The key itself never leaves its closure in `wallet.ts`.
 */

export type Identity = { party: string; name: string; account: string };
export type Topology = Awaited<ReturnType<typeof remote.lookup>>;

/** Which party this key is, and whether it already exists on the ledger. */
export const lookup = (s: Signer): Promise<Topology> => remote.lookup(toBase64(s.publicKey));

/** Creates the party for a new key. The key signs its own topology; the server only forwards. */
export async function enrol(s: Signer, topology: Topology, name: string): Promise<Identity> {
	await verifyTopology(topology, s.publicKey, PARTY_HINT);

	const {
		party,
		account,
		name: chosen
	} = await remote.enrol({
		publicKey: toBase64(s.publicKey),
		multiHash: topology.multiHash,
		signature: s.sign(topology.multiHash),
		name
	});
	return { party, name: chosen, account };
}

type Prepared = {
	preparedTransaction: string;
	preparedTransactionHash: string;
	hashingSchemeVersion: string;
};

/** Verify and sign a prepared transaction here, then let the server execute it. */
async function sign(
	s: Signer,
	who: Identity,
	choice: string,
	contractId: string,
	args: { [field: string]: Plain },
	prepared: Prepared
): Promise<void> {
	await verifyPrepared(prepared, { party: who.party, choice, contractId, args });
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
	// Members arrive as party ids, checked against the registry as they were typed.
	const members = input.members;
	// The DAO's identity is decided here, so it can be checked here.
	const id = crypto.randomUUID();
	// The server trims names and titles before preparing; sign the same bytes it prepares.
	const args = { daoName: input.name.trim(), description: input.description, members, id };
	const prepared = await remote.prepareCreateDao({ party: who.party, ...args });
	await sign(s, who, 'Account_CreateDAO', who.account, args, prepared);
}

export async function createProposal(
	s: Signer,
	who: Identity,
	input: { dao: string; title: string; description: string; days: number }
): Promise<void> {
	// The proposal's identity and deadline are decided here, so they can be checked here.
	const id = crypto.randomUUID();
	const closesAt = new Date(Date.now() + input.days * 86_400_000).toISOString();
	const args = {
		proposer: who.party,
		title: input.title.trim(),
		description: input.description,
		closesAt,
		id
	};
	const prepared = await remote.prepareCreateProposal({
		party: who.party,
		dao: input.dao,
		...args
	});
	await sign(s, who, 'DAO_CreateProposal', input.dao, args, prepared);
}

/** `contractId` is the proposal as the page last saw it; a vote in between makes this fail loudly. */
export async function vote(s: Signer, who: Identity, contractId: string, choice: 'Yes' | 'No') {
	const args = { voter: who.party, vote: choice };
	const prepared = await remote.prepareVote({ party: who.party, contractId, vote: choice });
	await sign(s, who, 'Proposal_Vote', contractId, args, prepared);
}

/** `dao` is the DAO contract as the page last saw it; an edit in between makes this fail loudly. */
export async function updateDao(
	s: Signer,
	who: Identity,
	dao: string,
	input: { name: string; description: string; members: string[] }
): Promise<void> {
	const members = input.members;
	const args = { daoName: input.name.trim(), description: input.description, members };
	const prepared = await remote.prepareUpdateDao({ party: who.party, dao, ...args });
	await sign(s, who, 'DAO_Update', dao, args, prepared);
}

export async function archiveDao(s: Signer, who: Identity, dao: string): Promise<void> {
	const prepared = await remote.prepareArchiveDao({ party: who.party, dao });
	await sign(s, who, 'DAO_Archive', dao, {}, prepared);
}

export async function updateProposal(
	s: Signer,
	who: Identity,
	contractId: string,
	input: { title: string; description: string }
): Promise<void> {
	const args = { title: input.title.trim(), description: input.description };
	const prepared = await remote.prepareUpdateProposal({ party: who.party, contractId, ...args });
	await sign(s, who, 'Proposal_Update', contractId, args, prepared);
}

export async function cancelProposal(s: Signer, who: Identity, contractId: string) {
	const args = { canceller: who.party };
	const prepared = await remote.prepareCancelProposal({ party: who.party, contractId });
	await sign(s, who, 'Proposal_Cancel', contractId, args, prepared);
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

/** Records the outcome of a proposal whose deadline has passed. Any member may. */
export async function closeProposal(s: Signer, who: Identity, contractId: string) {
	const args = { closer: who.party };
	const prepared = await remote.prepareCloseProposal({ party: who.party, contractId });
	await sign(s, who, 'Proposal_Close', contractId, args, prepared);
}
