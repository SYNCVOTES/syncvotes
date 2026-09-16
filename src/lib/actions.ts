import * as remote from './api.remote';
import { toBase64, type Signer } from './wallet';
import { verifyPrepared, verifyTopology, fingerprintOf, type Plain } from './verify';

/**
 * The browser's half of every ledger operation. The server prepares transactions; this file
 * decides what the user meant, checks what comes back against that (`verify.ts`), has the
 * signer sign it and sends it on. The key itself never leaves its closure in `wallet.ts`.
 *
 * Big DAOs mean batches: adding a thousand members or opening a vote for them is several
 * transactions, each prepared, checked and signed in turn, with no prompt in between.
 */

export type Identity = { party: string; account: string };
export type Lookup = Awaited<ReturnType<typeof remote.lookup>>;
export type Topology = Awaited<ReturnType<typeof remote.topology>>;
export type Progress = (done: number, total: number) => void;

/** Members per transaction. Adding a member is a small create. */
export const BATCH = 200;
/** Voting rights per transaction: each is a fetch and a create, and the signed transaction travels back up. */
export const RIGHTS_BATCH = 100;

/** Whether the ledger already knows this key. */
export const lookup = (s: Signer): Promise<Lookup> => remote.lookup(toBase64(s.publicKey));

/** The party id this key gets under `hint`: hint, two colons, the key's fingerprint. */
export const partyFor = async (s: Signer, hint: string) =>
	`${hint}::${await fingerprintOf(s.publicKey)}`;

/** What creating the party under `hint` would sign. */
export const topology = (s: Signer, hint: string): Promise<Topology> =>
	remote.topology({ publicKey: toBase64(s.publicKey), hint });

/** Creates the party for a new key. The key signs its own topology; the server only forwards. */
export async function enrol(s: Signer, hint: string, topology: Topology): Promise<Identity> {
	await verifyTopology(topology, s.publicKey, hint);
	const { party, account } = await remote.enrol({
		publicKey: toBase64(s.publicKey),
		hint,
		multiHash: topology.multiHash,
		signature: s.sign(topology.multiHash)
	});
	return { party, account };
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

/** What a remote form hands back: a prepared transaction and what it is supposed to do. */
export type FormResult = {
	choice: string;
	contractId: string;
	args: { [field: string]: Plain };
	prepared: {
		preparedTransaction: string;
		preparedTransactionHash: string;
		hashingSchemeVersion: string;
	};
};

/** Signs what a form's server half prepared — after checking it says what the form asked. */
export const signPrepared = (s: Signer, who: Identity, p: FormResult) =>
	sign(s, who, p.choice, p.contractId, p.args, p.prepared);

const chunks = <T>(items: T[], size: number): T[][] => {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
};

// ---- DAOs ---------------------------------------------------------------------------------

export async function archiveDao(s: Signer, who: Identity, dao: string) {
	const prepared = await remote.prepareArchiveDao({ party: who.party, dao });
	await sign(s, who, 'DAO_Archive', dao, {}, prepared);
}

/** Adds members a batch at a time; `dao` is re-read between batches only if the page does. */
export async function addMembers(
	s: Signer,
	who: Identity,
	dao: string,
	parties: string[],
	progress?: Progress
) {
	const batches = chunks(parties, BATCH);
	for (const [i, batch] of batches.entries()) {
		progress?.(i, batches.length);
		const prepared = await remote.prepareAddMembers({ party: who.party, dao, parties: batch });
		await sign(s, who, 'DAO_AddMembers', dao, { parties: batch }, prepared);
	}
	progress?.(batches.length, batches.length);
}

export async function removeMembers(
	s: Signer,
	who: Identity,
	dao: string,
	members: string[],
	progress?: Progress
) {
	const batches = chunks(members, BATCH);
	for (const [i, batch] of batches.entries()) {
		progress?.(i, batches.length);
		const prepared = await remote.prepareRemoveMembers({ party: who.party, dao, members: batch });
		await sign(s, who, 'DAO_RemoveMembers', dao, { members: batch }, prepared);
	}
	progress?.(batches.length, batches.length);
}

// ---- Proposals ----------------------------------------------------------------------------

/** Issues rights to every current member and opens the vote. Safe to run again if it stopped. */
export async function openVoting(
	s: Signer,
	who: Identity,
	pid: string,
	daoId: string,
	progress?: Progress
) {
	const members = await remote.memberCids(daoId);
	const batches = chunks(members, RIGHTS_BATCH);
	let proposal = await currentContract(pid);
	for (const [i, batch] of batches.entries()) {
		progress?.(i, batches.length + 1);
		const prepared = await remote.prepareIssueRights({
			party: who.party,
			proposal,
			members: batch
		});
		await sign(s, who, 'Proposal_IssueRights', proposal, { members: batch }, prepared);
		proposal = await currentContract(pid);
	}
	progress?.(batches.length, batches.length + 1);
	const prepared = await remote.prepareReady({ party: who.party, proposal });
	await sign(s, who, 'Proposal_Ready', proposal, {}, prepared);
	progress?.(batches.length + 1, batches.length + 1);
}

/** Each step replaces the proposal contract; the next step needs the new id. */
async function currentContract(pid: string): Promise<string> {
	for (let attempt = 0; attempt < 20; attempt++) {
		const p = await remote.proposal(pid);
		if (p.contractId) return p.contractId;
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error('The proposal did not appear on the ledger');
}

export async function cancelProposal(s: Signer, who: Identity, proposal: string) {
	const prepared = await remote.prepareCancelProposal({ party: who.party, proposal });
	await sign(s, who, 'Proposal_Cancel', proposal, { canceller: who.party }, prepared);
}

/** `right` is the voting right the page showed; it is spent by the ballot. */
export async function vote(s: Signer, who: Identity, right: string, choice: 'Yes' | 'No') {
	const args = { vote: choice };
	const prepared = await remote.prepareVote({ party: who.party, right, vote: choice });
	await sign(s, who, 'VoteRight_Cast', right, args, prepared);
}
