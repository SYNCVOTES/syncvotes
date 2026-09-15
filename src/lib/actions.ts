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

/** Names → parties, resolved here so the signed member list is the one the user typed. */
async function resolve(names: string[]): Promise<string[]> {
	const directory = await remote.directory();
	return names.map((raw) => {
		const name = raw.trim().toLowerCase();
		const found = directory.find((e) => e.name === name);
		if (!found) throw new Error(`Nobody is registered as "${name}"`);
		return found.party;
	});
}

export async function createDao(
	s: Signer,
	who: Identity,
	input: { name: string; description: string; members: string[] }
): Promise<void> {
	const members = await resolve(input.members);
	// The DAO's identity is decided here, so it can be checked here.
	const id = crypto.randomUUID();
	const args = { daoName: input.name, description: input.description, members, id };
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
		title: input.title,
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
	const members = await resolve(input.members);
	const args = { daoName: input.name, description: input.description, members };
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
	const prepared = await remote.prepareUpdateProposal({ party: who.party, contractId, ...input });
	await sign(s, who, 'Proposal_Update', contractId, input, prepared);
}

export async function cancelProposal(s: Signer, who: Identity, contractId: string) {
	const args = { canceller: who.party };
	const prepared = await remote.prepareCancelProposal({ party: who.party, contractId });
	await sign(s, who, 'Proposal_Cancel', contractId, args, prepared);
}
