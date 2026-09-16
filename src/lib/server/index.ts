import { Main } from '@daml.js/model';

/**
 * The app's view of the ledger, in memory: every contract the operator can see, indexed the way
 * the pages ask for it. Filled from the active contract set at startup and kept current from
 * the update stream (`feed.ts`), so a read never touches the participant and a DAO of ten
 * thousand costs a map lookup. Pages wait on the keys they show; a change fires only those.
 */

export type Vote = 'Yes' | 'No';
export type Outcome = 'Passed' | 'Failed';

export type Account = { contractId: string; party: string };
export type Dao = {
	contractId: string;
	id: string;
	admin: string;
	name: string;
	description: string;
	createdAt: string;
};
export type Member = { contractId: string; daoId: string; party: string; since: string };
export type Proposal = {
	contractId: string;
	id: string;
	daoId: string;
	daoName: string;
	admin: string;
	proposer: string;
	title: string;
	description: string;
	closesAt: string;
	createdAt: string;
	eligible: number;
	ready: boolean;
	yes: number;
	no: number;
	outcome: Outcome | null;
};
export type VoteRight = { contractId: string; proposalId: string; voter: string; closesAt: string };
export type Ballot = {
	contractId: string;
	proposalId: string;
	voter: string;
	vote: Vote;
	castAt: string;
	counted: boolean;
};

const int = (v: unknown) => Number(v);

// ---- the tables --------------------------------------------------------------------------

export const accounts = new Map<string, Account>();
const accountByCid = new Map<string, string>();
export const daos = new Map<string, Dao>();
const daoByCid = new Map<string, string>();
/** daoId → party → member */
export const members = new Map<string, Map<string, Member>>();
const memberByCid = new Map<string, Member>();
/** party → daoIds */
export const memberships = new Map<string, Set<string>>();
export const proposals = new Map<string, Proposal>();
const proposalByCid = new Map<string, string>();
/** daoId → proposal ids */
export const proposalsByDao = new Map<string, Set<string>>();
/** proposalId → voter → right */
export const rights = new Map<string, Map<string, VoteRight>>();
const rightByCid = new Map<string, VoteRight>();
/** proposalId → voter → ballot (cast, or counted) */
export const ballots = new Map<string, Map<string, Ballot>>();
const ballotByCid = new Map<string, Ballot>();

const bucket = <K, V>(map: Map<K, Map<string, V>>, key: K) => {
	let inner = map.get(key);
	if (!inner) map.set(key, (inner = new Map()));
	return inner;
};
const setOf = <K>(map: Map<K, Set<string>>, key: K) => {
	let inner = map.get(key);
	if (!inner) map.set(key, (inner = new Set()));
	return inner;
};

// ---- change notification -----------------------------------------------------------------

const waiters = new Map<string, Set<() => void>>();

/** Resolves the next time anything under `key` changes. */
export const nextChange = (key: string) =>
	new Promise<void>((resolve) => {
		let set = waiters.get(key);
		if (!set) waiters.set(key, (set = new Set()));
		set.add(resolve);
	});

function fire(keys: Iterable<string>) {
	for (const key of keys) {
		const set = waiters.get(key);
		if (!set) continue;
		waiters.delete(key);
		for (const wake of set) wake();
	}
}

/** A change touched these keys; fired once per applied transaction. */
const touched = new Set<string>();
const touch = (...keys: string[]) => keys.forEach((k) => touched.add(k));

export const keys = {
	dao: (id: string) => `dao:${id}`,
	proposal: (id: string) => `proposal:${id}`,
	party: (party: string) => `party:${party}`,
	all: 'all'
};

// ---- applying events ----------------------------------------------------------------------

type Created = { contractId: string; templateId: string; createArgument: Record<string, unknown> };

const template = (id: string) => id.split(':').slice(-2).join(':');
const is = (templateId: string, t: { templateId: string }) =>
	template(templateId) === template(t.templateId);

export function created(e: Created) {
	const a = e.createArgument;
	if (is(e.templateId, Main.Account)) {
		const party = a.user as string;
		accounts.set(party, { contractId: e.contractId, party });
		accountByCid.set(e.contractId, party);
		touch(keys.all);
	} else if (is(e.templateId, Main.DAO)) {
		const dao: Dao = {
			contractId: e.contractId,
			id: a.id as string,
			admin: a.admin as string,
			name: a.name as string,
			description: a.description as string,
			createdAt: a.createdAt as string
		};
		daos.set(dao.id, dao);
		daoByCid.set(e.contractId, dao.id);
		touch(keys.dao(dao.id), keys.party(dao.admin), keys.all);
	} else if (is(e.templateId, Main.Member)) {
		const m: Member = {
			contractId: e.contractId,
			daoId: a.daoId as string,
			party: a.party as string,
			since: a.since as string
		};
		bucket(members, m.daoId).set(m.party, m);
		memberByCid.set(e.contractId, m);
		setOf(memberships, m.party).add(m.daoId);
		touch(keys.dao(m.daoId), keys.party(m.party), keys.all);
	} else if (is(e.templateId, Main.Proposal)) {
		const p: Proposal = {
			contractId: e.contractId,
			id: a.id as string,
			daoId: a.daoId as string,
			daoName: a.daoName as string,
			admin: a.admin as string,
			proposer: a.proposer as string,
			title: a.title as string,
			description: a.description as string,
			closesAt: a.closesAt as string,
			createdAt: a.createdAt as string,
			eligible: int(a.eligible),
			ready: a.ready as boolean,
			yes: int(a.yes),
			no: int(a.no),
			outcome: (a.outcome as Outcome | null | undefined) ?? null
		};
		proposals.set(p.id, p);
		proposalByCid.set(e.contractId, p.id);
		setOf(proposalsByDao, p.daoId).add(p.id);
		touch(keys.proposal(p.id), keys.dao(p.daoId), keys.all);
	} else if (is(e.templateId, Main.VoteRight)) {
		const r: VoteRight = {
			contractId: e.contractId,
			proposalId: a.proposalId as string,
			voter: a.voter as string,
			closesAt: a.closesAt as string
		};
		bucket(rights, r.proposalId).set(r.voter, r);
		rightByCid.set(e.contractId, r);
		touch(keys.proposal(r.proposalId), keys.party(r.voter));
	} else if (is(e.templateId, Main.Ballot) || is(e.templateId, Main.CountedBallot)) {
		const b: Ballot = {
			contractId: e.contractId,
			proposalId: a.proposalId as string,
			voter: a.voter as string,
			vote: a.vote as Vote,
			castAt: a.castAt as string,
			counted: is(e.templateId, Main.CountedBallot)
		};
		bucket(ballots, b.proposalId).set(b.voter, b);
		ballotByCid.set(e.contractId, b);
		touch(keys.proposal(b.proposalId), keys.party(b.voter), keys.all);
	}
}

export function archived(contractId: string) {
	const owner = accountByCid.get(contractId);
	if (owner) {
		accountByCid.delete(contractId);
		if (accounts.get(owner)?.contractId === contractId) accounts.delete(owner);
		touch(keys.all);
		return;
	}
	const daoId = daoByCid.get(contractId);
	if (daoId) {
		daoByCid.delete(contractId);
		const dao = daos.get(daoId);
		// An edit archives the old contract after the new one was created in the same
		// transaction; only drop the DAO when this was its current contract.
		if (dao && dao.contractId === contractId) {
			daos.delete(daoId);
			touch(keys.dao(daoId), keys.party(dao.admin), keys.all);
		}
		return;
	}
	const m = memberByCid.get(contractId);
	if (m) {
		memberByCid.delete(contractId);
		members.get(m.daoId)?.delete(m.party);
		memberships.get(m.party)?.delete(m.daoId);
		touch(keys.dao(m.daoId), keys.party(m.party), keys.all);
		return;
	}
	const pid = proposalByCid.get(contractId);
	if (pid) {
		proposalByCid.delete(contractId);
		const p = proposals.get(pid);
		if (p && p.contractId === contractId) {
			proposals.delete(pid);
			proposalsByDao.get(p.daoId)?.delete(pid);
			touch(keys.proposal(pid), keys.dao(p.daoId), keys.all);
		}
		return;
	}
	const r = rightByCid.get(contractId);
	if (r) {
		rightByCid.delete(contractId);
		rights.get(r.proposalId)?.delete(r.voter);
		touch(keys.proposal(r.proposalId), keys.party(r.voter));
		return;
	}
	const b = ballotByCid.get(contractId);
	if (b) {
		ballotByCid.delete(contractId);
		// A counted ballot replaces the cast one in the same transaction; keep whichever is newer.
		const current = ballots.get(b.proposalId)?.get(b.voter);
		if (current && current.contractId === contractId) ballots.get(b.proposalId)?.delete(b.voter);
		touch(keys.proposal(b.proposalId), keys.party(b.voter));
	}
}

/** The DAO whose current contract this is, if any. */
export const daoByContract = (contractId: string) => {
	const id = daoByCid.get(contractId);
	const dao = id ? daos.get(id) : undefined;
	return dao?.contractId === contractId ? dao : undefined;
};

/** The proposal whose current contract this is, if any. */
export const proposalByContract = (contractId: string) => {
	const id = proposalByCid.get(contractId);
	const p = id ? proposals.get(id) : undefined;
	return p?.contractId === contractId ? p : undefined;
};

/** Called after each transaction's events were applied: wake whoever watches what changed. */
export function commit() {
	if (touched.size === 0) return;
	const changed = [...touched, keys.all];
	touched.clear();
	fire(changed);
}

export const TEMPLATES = [
	Main.Account,
	Main.DAO,
	Main.Member,
	Main.Proposal,
	Main.VoteRight,
	Main.Ballot,
	Main.CountedBallot
].map((t) => t.templateId);
