import * as remote from './api.remote';
import { toBase64, type Signer } from './wallet';
import {
	verifyPrepared,
	verifyTopology,
	verifyTreasury,
	type Expected,
	type Plain
} from './verify';
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
	const intent = { choice: 'DAO_Archive', contractId: dao.contractId, args: { admin: who.party } };
	await sign(s, who, intent, prepared);
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
		const args = { admin: who.party, parties: batch };
		await sign(s, who, { choice: 'DAO_AddMembers', contractId, args }, prepared);
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
		const args = { admin: who.party, memberCids: batch };
		await sign(s, who, { choice: 'DAO_RemoveMembers', contractId, args }, prepared);
	});

/** The admins become exactly `admins`; the DAO contract of the moment is the one signed. */
export async function setAdmins(s: Signer, who: Identity, daoId: string, admins: string[]) {
	const { contractId } = await remote.dao(daoId);
	const prepared = await remote.prepareSetAdmins({ dao: daoId, admins });
	const args = { admin: who.party, newAdmins: admins };
	await sign(s, who, { choice: 'DAO_SetAdmins', contractId, args }, prepared);
}

export async function setVoting(
	s: Signer,
	who: Identity,
	daoId: string,
	voting: 'member' | 'stake',
	quorum: number
) {
	const { contractId } = await remote.dao(daoId);
	const { voting: newVoting, prepared } = await remote.prepareSetVoting({
		dao: daoId,
		voting,
		quorum
	});
	// The instrument is the server's to name (the network's coin); the kind and quorum are ours.
	const want: Plain =
		voting === 'stake'
			? { tag: 'ByStake', value: { quorum: quorum.toFixed(10) } }
			: { tag: 'ByMember', value: {} };
	if (!covers(want, newVoting as Plain)) throw new Error('The server changed the voting rule');
	const args = { admin: who.party, newVoting: newVoting as Plain };
	await sign(s, who, { choice: 'DAO_SetVoting', contractId, args }, prepared);
}

const covers = (want: Plain, got: Plain): boolean =>
	typeof want === 'object' && want !== null && !Array.isArray(want)
		? typeof got === 'object' &&
			got !== null &&
			!Array.isArray(got) &&
			Object.keys(want).every((k) => covers(want[k], got[k]))
		: want === got;

// ---- Proposals ----------------------------------------------------------------------------

export async function cancelProposal(s: Signer, who: Identity, proposalId: string) {
	const { contractId } = await remote.proposal(proposalId);
	const { dao, prepared } = await remote.prepareCancelProposal(proposalId);
	const args = { canceller: who.party, dao };
	await sign(s, who, { choice: 'Proposal_Cancel', contractId, args }, prepared);
}

export type Choice = 'Yes' | 'No' | 'Abstain';

/**
 * A ballot is cast from the voter's own membership contract, which the proposal page names.
 * In a stake DAO it carries the voter's locked coin that outlasts the deadline: the browser
 * picks those from its own holdings, so the weight signed is the weight meant.
 */
export async function vote(s: Signer, who: Identity, proposalId: string, choice: Choice) {
	const { me, closesAt, voting } = await remote.proposal(proposalId);
	if (!me.membership) throw new Error('You are not a member of this DAO');
	let stake: Plain = null;
	if (voting.kind === 'stake') {
		const { holdings } = await remote.myHoldings();
		const locked = holdings
			.filter((h) => h.lock && new Date(h.lock.expiresAt) >= new Date(closesAt))
			.slice(0, 20)
			.map((h) => h.contractId);
		if (locked.length === 0) {
			throw new Error("Lock some coin past the deadline first; that lock is your vote's weight");
		}
		stake = { _1: voting.instrument, _2: locked };
	}
	const prepared = await remote.prepareVote({
		proposal: proposalId,
		vote: choice,
		holdings: stake ? ((stake as { _2: string[] })._2 as string[]) : []
	});
	const intent = {
		choice: 'Member_Vote',
		contractId: me.membership,
		args: { proposalId, closesAt, vote: choice, stake }
	};
	await sign(s, who, intent, prepared);
}

// ---- Coin ---------------------------------------------------------------------------------

/** Locks `amount` of the signer's coin for `days`; nobody but time can open it. */
export async function lock(s: Signer, who: Identity, amount: number, days: number) {
	const { amount: asText, expiresAt, prepared } = await remote.prepareLock({ amount, days });
	if (Number(asText) !== amount) throw new Error('The amount changed on the way');
	const until = new Date(expiresAt).getTime();
	const meant = Date.now() + days * 86_400_000;
	if (Math.abs(until - meant) > 5 * 60_000) throw new Error('The lock would last another time');
	const intent: Intent = {
		choice: 'AmuletRules_Transfer',
		args: {
			transfer: {
				sender: who.party,
				provider: who.party,
				outputs: [
					{
						receiver: who.party,
						receiverFeeRatio: '0.0',
						amount: asText,
						lock: { holders: [], expiresAt, optContext: 'syncvotes stake' }
					}
				]
			}
		}
	};
	await sign(s, who, intent, prepared);
}

export async function release(s: Signer, who: Identity, contractId: string) {
	const prepared = await remote.prepareRelease(contractId);
	await sign(s, who, { choice: 'LockedAmulet_OwnerExpireLockV2', contractId, args: {} }, prepared);
}

/** The intent of a token-standard transfer, as far as the sender cares. */
export const transferIntent = (sender: string, receiver: string, amount: string): Intent => ({
	choice: 'TransferFactory_Transfer',
	args: { transfer: { sender, receiver, amount } }
});

// ---- Treasury -----------------------------------------------------------------------------

type TreasuryView = Awaited<ReturnType<typeof remote.daoTreasury>>;

/** An admin signs the treasury's identity, after checking it is the admins' and nobody else's. */
export async function signTreasurySetup(
	s: Signer,
	who: Identity,
	daoId: string,
	admins: string[],
	threshold: number,
	plan: NonNullable<TreasuryView['plan']>
) {
	await verifyTreasury(plan, admins, threshold, s.publicKey);
	await remote.treasurySignSetup({ dao: daoId, signature: s.sign(plan.multiHash) });
}

/** Records the treasury on the DAO: the party the admin signed for, with those signers. */
export async function recordTreasury(
	s: Signer,
	who: Identity,
	daoId: string,
	expected: { party: string; signers: string[]; threshold: number }
) {
	const { contractId } = await remote.dao(daoId);
	const { treasury, prepared } = await remote.prepareRecordTreasury(daoId);
	if (
		treasury.party !== expected.party ||
		treasury.threshold !== expected.threshold ||
		[...treasury.signers].sort().join() !== [...expected.signers].sort().join()
	) {
		throw new Error('The server would record a different treasury');
	}
	const args = { admin: who.party, newTreasury: treasury as Plain };
	await sign(s, who, { choice: 'DAO_SetTreasury', contractId, args }, prepared);
}

export async function dropTreasury(s: Signer, who: Identity, daoId: string) {
	const { contractId } = await remote.dao(daoId);
	const prepared = await remote.prepareDropTreasury(daoId);
	const args = { admin: who.party, newTreasury: null };
	await sign(s, who, { choice: 'DAO_SetTreasury', contractId, args }, prepared);
}

type Session = TreasuryView['sessions'][number];

/** What a treasury session's transaction must say, from the session's intent. */
function sessionIntent(party: string, s: Session): Expected[] {
	switch (s.intent.kind) {
		case 'approve':
			return [
				{
					party,
					choice: 'ExternalPartySetupProposal_Accept',
					contractId: s.intent.proposal,
					args: {}
				}
			];
		case 'payout':
			return [
				{ party, ...transferIntent(party, s.intent.to, s.intent.amount.toFixed(10)) },
				{ party, choice: 'PayoutDue_Settle', contractId: s.intent.due, args: {} }
			];
		case 'move':
			return [{ party, ...transferIntent(party, s.intent.to, s.intent.amount.toFixed(10)) }];
	}
}

/** A signer's signature on a session, once the transaction is verified to be the intent. */
export async function signSession(s: Signer, treasuryParty: string, session: Session) {
	await verifyPrepared(session.prepared, sessionIntent(treasuryParty, session));
	await remote.treasurySign({
		session: session.id,
		signature: s.sign(session.prepared.preparedTransactionHash)
	});
}
