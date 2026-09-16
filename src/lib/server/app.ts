import { error } from '@sveltejs/kit';
import { Main } from '@daml.js/model';
import { operatorParty, providerParty, submitAsProvider } from './participant';
import * as index from './index';

/**
 * Reads, from the index; and the one write the provider makes on its own: an Account for a new
 * party. Everything else a user does is prepared here and signed in the browser.
 */

export type { Account, Dao, Member, Proposal, VoteRight, Ballot } from './index';

export type Page<T> = { items: T[]; total: number; offset: number };

const page = <T>(all: T[], offset: number, limit: number): Page<T> => ({
	items: all.slice(offset, offset + limit),
	total: all.length,
	offset
});

// ---- accounts -----------------------------------------------------------------------------

export const accountOf = (party: string): index.Account => {
	const account = index.accounts.get(party);
	if (!account) throw error(404, 'This party is not registered with the app');
	return account;
};

export const isRegistered = (party: string) => index.accounts.has(party);

/** The party whose namespace is this key's fingerprint, if it registered before. */
export const accountByFingerprint = (fingerprint: string): index.Account | undefined => {
	for (const a of index.accounts.values()) if (a.party.split('::')[1] === fingerprint) return a;
	return undefined;
};

/** Registers a party: the provider creates its Account. Idempotent. */
export async function register(party: string): Promise<index.Account> {
	const mine = index.accounts.get(party);
	if (mine) return mine;
	await submitAsProvider(
		[
			{
				CreateCommand: {
					templateId: Main.Account.templateId,
					createArguments: { provider: providerParty(), operator: operatorParty(), user: party }
				}
			}
		],
		`register-${party.split('::')[1]}`
	);
	// The stream brings the new account within a moment; do not hang on it forever.
	for (let i = 0; i < 40 && !index.accounts.has(party); i++) {
		await Promise.race([index.nextChange(index.keys.all), new Promise((r) => setTimeout(r, 250))]);
	}
	return accountOf(party);
}

// ---- DAOs ---------------------------------------------------------------------------------

export function daoById(id: string): index.Dao {
	const dao = index.daos.get(id);
	if (!dao) throw error(404, 'No such DAO');
	return dao;
}

/** The browser names the contract it saw; if an edit replaced it meanwhile, say so. */
export function currentDao(contractId: string): index.Dao {
	for (const d of index.daos.values()) if (d.contractId === contractId) return d;
	throw error(409, 'This DAO changed while you were looking at it — reload and try again');
}

export const daosOf = (party: string): index.Dao[] =>
	[...(index.memberships.get(party) ?? [])]
		.map((id) => index.daos.get(id))
		.filter((d): d is index.Dao => !!d)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const memberCount = (daoId: string) => index.members.get(daoId)?.size ?? 0;
export const memberOf = (daoId: string, party: string) => index.members.get(daoId)?.get(party);
export const isMember = (daoId: string, party: string) => !!memberOf(daoId, party);

/** Members, alphabetically by party id, filtered by a substring of it. */
export function membersOf(
	daoId: string,
	offset: number,
	limit: number,
	q = ''
): Page<index.Member> {
	const needle = q.trim().toLowerCase();
	const all = [...(index.members.get(daoId)?.values() ?? [])]
		.filter((m) => !needle || m.party.toLowerCase().includes(needle))
		.sort((a, b) => a.party.localeCompare(b.party));
	return page(all, offset, limit);
}

/** Member contract ids in a stable order, for issuing rights in batches. */
export const memberCids = (daoId: string): string[] =>
	[...(index.members.get(daoId)?.values() ?? [])]
		.sort((a, b) => a.party.localeCompare(b.party))
		.map((m) => m.contractId);

// ---- proposals ----------------------------------------------------------------------------

export type ProposalStatus = 'open' | 'closed';

export function proposalById(id: string): index.Proposal {
	const p = index.proposals.get(id);
	if (!p) throw error(404, 'No such proposal');
	return p;
}

export function currentProposal(contractId: string): index.Proposal {
	for (const p of index.proposals.values()) if (p.contractId === contractId) return p;
	throw error(409, 'This proposal changed while you were looking at it — reload and try again');
}

export const proposalsOf = (daoId: string): index.Proposal[] =>
	[...(index.proposalsByDao.get(daoId) ?? [])]
		.map((id) => index.proposals.get(id))
		.filter((p): p is index.Proposal => !!p)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export function proposalPage(
	daoId: string,
	offset: number,
	limit: number,
	status?: ProposalStatus
): Page<index.Proposal> {
	const all = proposalsOf(daoId).filter((p) =>
		status === 'open' ? !p.outcome : status === 'closed' ? !!p.outcome : true
	);
	return page(all, offset, limit);
}

export const openCount = (daoId: string) => proposalsOf(daoId).filter((p) => !p.outcome).length;

export const rightOf = (proposalId: string, party: string) =>
	index.rights.get(proposalId)?.get(party);
export const ballotOf = (proposalId: string, party: string) =>
	index.ballots.get(proposalId)?.get(party);
export const ballotCount = (proposalId: string) => index.ballots.get(proposalId)?.size ?? 0;

/** Ballots, newest first, filtered by a substring of the voter's party id. */
export function ballotPage(
	proposalId: string,
	offset: number,
	limit: number,
	q = ''
): Page<index.Ballot> {
	const needle = q.trim().toLowerCase();
	const all = [...(index.ballots.get(proposalId)?.values() ?? [])]
		.filter((b) => !needle || b.voter.toLowerCase().includes(needle))
		.sort((a, b) => b.castAt.localeCompare(a.castAt));
	return page(all, offset, limit);
}

/** Cast ballots the provider has not counted yet, oldest first. */
export const uncounted = (proposalId: string, limit: number): index.Ballot[] =>
	[...(index.ballots.get(proposalId)?.values() ?? [])]
		.filter((b) => !b.counted)
		.sort((a, b) => a.castAt.localeCompare(b.castAt))
		.slice(0, limit);

export const stats = () => {
	let votes = 0;
	for (const b of index.ballots.values()) votes += b.size;
	let open = 0;
	for (const p of index.proposals.values()) if (!p.outcome) open++;
	return {
		daos: index.daos.size,
		openProposals: open,
		votesCast: votes,
		members: index.accounts.size
	};
};
