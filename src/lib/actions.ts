import * as remote from './api.remote';
import { toBase64, type Signer } from './wallet';
import { verifyPrepared, verifyTopology, type Expected, type Plain } from './verify';

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

/** Whether the ledger already knows this key. */
export const lookup = (s: Signer): Promise<Lookup> => remote.lookup(toBase64(s.publicKey));

/** What creating the party under `hint` would sign. */
export const topology = (s: Signer, hint: string): Promise<Topology> =>
	remote.topology({ publicKey: toBase64(s.publicKey), hint });

/** Creates the party for a new key. The key signs its own topology; the server only forwards. */
export async function enrol(s: Signer, hint: string, topology: Topology): Promise<Identity> {
	await verifyTopology(topology, s.publicKey, hint);
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
	await verifyPrepared(prepared, { party: who.party, ...intent });
	await remote.execute({ ...prepared, signature: s.sign(prepared.preparedTransactionHash) });
}

const batches = <T>(items: T[], size: number): T[][] =>
	Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
		items.slice(i * size, (i + 1) * size)
	);

/** Members join and leave a batch at a time; each batch is its own signed transaction. */
async function inBatches<T extends Plain>(
	items: T[],
	progress: Progress | undefined,
	each: (batch: T[]) => Promise<void>
) {
	const all = batches(items, remote.BATCH);
	for (const [i, batch] of all.entries()) {
		progress?.(i, all.length);
		await each(batch);
	}
	progress?.(all.length, all.length);
}

// ---- DAOs ---------------------------------------------------------------------------------

export async function archiveDao(
	s: Signer,
	who: Identity,
	dao: { id: string; contractId: string }
) {
	const prepared = await remote.prepareArchiveDao(dao.id);
	await sign(s, who, { choice: 'DAO_Archive', contractId: dao.contractId, args: {} }, prepared);
}

/** Each batch replaces the DAO contract, so the current one is looked up again in between. */
export const addMembers = (
	s: Signer,
	who: Identity,
	daoId: string,
	parties: string[],
	progress?: Progress
) =>
	inBatches(parties, progress, async (batch) => {
		const { contractId } = await remote.dao(daoId);
		const prepared = await remote.prepareAddMembers({ dao: daoId, parties: batch });
		await sign(
			s,
			who,
			{ choice: 'DAO_AddMembers', contractId, args: { parties: batch } },
			prepared
		);
	});

export const removeMembers = (
	s: Signer,
	who: Identity,
	daoId: string,
	memberCids: string[],
	progress?: Progress
) =>
	inBatches(memberCids, progress, async (batch) => {
		const { contractId } = await remote.dao(daoId);
		const prepared = await remote.prepareRemoveMembers({ dao: daoId, memberCids: batch });
		await sign(
			s,
			who,
			{ choice: 'DAO_RemoveMembers', contractId, args: { memberCids: batch } },
			prepared
		);
	});

// ---- Proposals ----------------------------------------------------------------------------

/** Opens the vote on a draft: the DAO's members as of now become the electorate. */
export async function openProposal(s: Signer, who: Identity, proposalId: string) {
	const { contractId, daoContractId } = await remote.proposal(proposalId);
	if (!daoContractId) throw new Error('The DAO is gone');
	const prepared = await remote.prepareOpenProposal(proposalId);
	const intent = { choice: 'Proposal_Open', contractId, args: { dao: daoContractId } };
	await sign(s, who, intent, prepared);
}

export async function cancelProposal(s: Signer, who: Identity, proposalId: string) {
	const { contractId } = await remote.proposal(proposalId);
	const prepared = await remote.prepareCancelProposal(proposalId);
	const intent = { choice: 'Proposal_Cancel', contractId, args: { canceller: who.party } };
	await sign(s, who, intent, prepared);
}

/** A ballot is cast from the voter's own membership contract, which the proposal page names. */
export async function vote(s: Signer, who: Identity, proposalId: string, choice: 'Yes' | 'No') {
	const { me } = await remote.proposal(proposalId);
	if (!me.membership) throw new Error('You are not a member of this DAO');
	const prepared = await remote.prepareVote({ proposal: proposalId, vote: choice });
	const intent = {
		choice: 'Member_Vote',
		contractId: me.membership,
		args: { proposalId, vote: choice }
	};
	await sign(s, who, intent, prepared);
}
