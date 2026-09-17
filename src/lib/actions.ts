import * as remote from './api.remote';
import { toBase64, type Signer } from './wallet';
import { verifyPrepared, verifyTopology, type Expected, type Plain } from './verify';
import { BATCH } from './schemas';

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

/**
 * Members join and leave a batch at a time, each batch its own signed transaction on the DAO
 * contract of the moment. A batch replaces that contract, so the next one waits for the live
 * query to show the replacement before it is prepared.
 */
async function inBatches<T extends Plain>(
	items: T[],
	daoId: string,
	progress: Progress | undefined,
	each: (batch: T[], daoContractId: string) => Promise<void>
) {
	const all = Array.from({ length: Math.ceil(items.length / BATCH) }, (_, i) =>
		items.slice(i * BATCH, (i + 1) * BATCH)
	);
	let consumed: string | undefined;
	for (const [i, batch] of all.entries()) {
		progress?.(i, all.length);
		for await (const dao of remote.dao(daoId)) {
			if (dao.contractId === consumed) continue;
			await each(batch, dao.contractId);
			consumed = dao.contractId;
			break;
		}
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

export const addMembers = (
	s: Signer,
	who: Identity,
	daoId: string,
	parties: string[],
	progress?: Progress
) =>
	inBatches(parties, daoId, progress, async (batch, contractId) => {
		const prepared = await remote.prepareAddMembers({ dao: daoId, parties: batch });
		const intent = { choice: 'DAO_AddMembers', contractId, args: { parties: batch } };
		await sign(s, who, intent, prepared);
	});

export const removeMembers = (
	s: Signer,
	who: Identity,
	daoId: string,
	memberCids: string[],
	progress?: Progress
) =>
	inBatches(memberCids, daoId, progress, async (batch, contractId) => {
		const prepared = await remote.prepareRemoveMembers({ dao: daoId, memberCids: batch });
		const intent = { choice: 'DAO_RemoveMembers', contractId, args: { memberCids: batch } };
		await sign(s, who, intent, prepared);
	});

// ---- Proposals ----------------------------------------------------------------------------

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
