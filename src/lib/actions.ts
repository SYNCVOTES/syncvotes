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

export const BATCH = 200;

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

const chunks = <T>(items: T[], size: number): T[][] => {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
};

// ---- DAOs ---------------------------------------------------------------------------------

export async function createDao(
	s: Signer,
	who: Identity,
	input: { name: string; description: string }
) {
	// The DAO's identity is decided here, so it can be checked here.
	const args = {
		daoName: input.name.trim(),
		description: input.description,
		id: crypto.randomUUID()
	};
	const prepared = await remote.prepareCreateDao({ party: who.party, ...args });
	await sign(s, who, 'Account_CreateDAO', who.account, args, prepared);
	return args.id;
}

/** `dao` is the DAO contract as the page last saw it; an edit in between makes this fail loudly. */
export async function updateDao(
	s: Signer,
	who: Identity,
	dao: string,
	input: { name: string; description: string }
) {
	const args = { daoName: input.name.trim(), description: input.description };
	const prepared = await remote.prepareUpdateDao({ party: who.party, dao, ...args });
	await sign(s, who, 'DAO_Update', dao, args, prepared);
}

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

/**
 * Three steps: the proposal itself, a voting right for every member (in batches), then opening
 * the vote. The proposal exists on the ledger after step one; if the tab dies in between, the
 * proposer finds it unopened and can finish from the proposal page.
 */
export async function createProposal(
	s: Signer,
	who: Identity,
	input: {
		dao: string;
		daoId: string;
		membership: string;
		title: string;
		description: string;
		days: number;
	},
	progress?: Progress
): Promise<string> {
	const pid = crypto.randomUUID();
	const closesAt = new Date(Date.now() + input.days * 86_400_000).toISOString();
	const args = {
		proposer: who.party,
		membership: input.membership,
		title: input.title.trim(),
		description: input.description,
		closesAt,
		pid
	};
	const prepared = await remote.prepareCreateProposal({
		party: who.party,
		dao: input.dao,
		...args
	});
	await sign(s, who, 'DAO_CreateProposal', input.dao, args, prepared);
	await openVoting(s, who, pid, input.daoId, progress);
	return pid;
}

/** Issues rights to every current member and opens the vote. Safe to run again if it stopped. */
export async function openVoting(
	s: Signer,
	who: Identity,
	pid: string,
	daoId: string,
	progress?: Progress
) {
	const members = await remote.memberCids(daoId);
	const batches = chunks(members, BATCH);
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

export async function updateProposal(
	s: Signer,
	who: Identity,
	proposal: string,
	input: { title: string; description: string }
) {
	const args = { title: input.title.trim(), description: input.description };
	const prepared = await remote.prepareUpdateProposal({ party: who.party, proposal, ...args });
	await sign(s, who, 'Proposal_Update', proposal, args, prepared);
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
