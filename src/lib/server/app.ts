import { error } from '@sveltejs/kit';
import { Main } from '@daml.js/model';
import { activeContracts, operatorParty, providerParty, submitAsProvider } from './participant';
import { PARTY_HINT } from '../party';

export { PARTY_HINT };

/**
 * The app's own view of the ledger, read as the operator: it observes every Account, DAO and
 * Proposal, so it can list them for a member and resolve names to parties. Nothing here writes
 * on a user's behalf — the one write, creating an Account, is the provider's own signature.
 */

export type Account = { contractId: string; party: string; name: string };
export type Dao = {
	contractId: string;
	/** The stable handle; the contract id changes with every edit. Older DAOs have none. */
	id: string;
	admin: string;
	name: string;
	description: string;
	members: string[];
	/** ISO time; DAOs from before 0.1.3 have none. */
	createdAt: string | null;
};
export type Ballot = { voter: string; vote: 'Yes' | 'No' };
export type Proposal = {
	contractId: string;
	/** The stable handle; the contract id changes with every vote. Older proposals have none. */
	id: string;
	dao: string;
	daoName: string;
	proposer: string;
	title: string;
	description: string;
	members: string[];
	closesAt: string;
	ballots: Ballot[];
	outcome: 'Passed' | 'Failed' | null;
	createdAt: string | null;
	/** The DAO's stable id (its contract id for proposals from before 0.1.4). */
	daoId: string;
	admin: string | null;
};

const read = <T>(templateId: string) => activeContracts<T>(operatorParty(), templateId);

export async function accounts(): Promise<Account[]> {
	const found = await read<{ user: string; name: string }>(Main.Account.templateId);
	return found.map((c) => ({
		contractId: c.contractId,
		party: c.payload.user,
		name: c.payload.name
	}));
}

export async function accountOf(party: string): Promise<Account> {
	const account = (await accounts()).find((a) => a.party === party);
	if (!account) throw error(404, 'This party is not registered with the app');
	return account;
}

/** Names are what users type to reach each other, so keep them short and unambiguous. */
export function normaliseName(input: unknown): string {
	if (typeof input !== 'string') throw error(400, 'Name is required');

	const name = input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-');
	if (name.length < 2 || name.length > 30) throw error(400, 'Name must be 2-30 characters');

	return name;
}

/** Registers a party under a name. Uniqueness is checked here; Daml-LF 2.2 has no contract keys. */
export async function register(party: string, name: string): Promise<Account> {
	const all = await accounts();

	const mine = all.find((a) => a.party === party);
	if (mine) return mine;

	if (all.some((a) => a.name === name)) throw error(409, `The name "${name}" is taken`);

	await submitAsProvider(
		[
			{
				CreateCommand: {
					templateId: Main.Account.templateId,
					createArguments: {
						provider: providerParty(),
						operator: operatorParty(),
						user: party,
						name
					}
				}
			}
		],
		`register-${name}`
	);

	return accountOf(party);
}

type DaoPayload = Omit<Dao, 'contractId' | 'createdAt' | 'id'> & {
	createdAt: string | null | undefined;
	id: string | null | undefined;
};

export async function daos(): Promise<Dao[]> {
	const found = await read<DaoPayload>(Main.DAO.templateId);
	return found.map((c) => ({
		...c.payload,
		contractId: c.contractId,
		id: c.payload.id ?? c.contractId,
		createdAt: c.payload.createdAt ?? null
	}));
}

/** By stable id, or by contract id for DAOs from before 0.1.4. */
export async function daoById(id: string): Promise<Dao> {
	const dao = (await daos()).find((d) => d.id === id || d.contractId === id);
	if (!dao) throw error(404, 'No such DAO');
	return dao;
}

/** The browser names the contract it saw; if an edit replaced it meanwhile, say so. */
export async function currentDao(contractId: string): Promise<Dao> {
	const dao = (await daos()).find((d) => d.contractId === contractId);
	if (!dao)
		throw error(409, 'This DAO changed while you were looking at it — reload and try again');
	return dao;
}

type ProposalPayload = Omit<
	Proposal,
	'contractId' | 'outcome' | 'id' | 'createdAt' | 'daoId' | 'admin'
> & {
	outcome: 'Passed' | 'Failed' | null | undefined;
	id: string | null | undefined;
	createdAt: string | null | undefined;
	daoId: string | null | undefined;
	admin: string | null | undefined;
};

export async function proposals(): Promise<Proposal[]> {
	const found = await read<ProposalPayload>(Main.Proposal.templateId);
	return found.map((c) => ({
		...c.payload,
		contractId: c.contractId,
		id: c.payload.id ?? c.contractId,
		outcome: c.payload.outcome ?? null,
		createdAt: c.payload.createdAt ?? null,
		daoId: c.payload.daoId ?? c.payload.dao,
		admin: c.payload.admin ?? null
	}));
}

export async function proposalById(id: string): Promise<Proposal> {
	const proposal = (await proposals()).find((p) => p.id === id);
	if (!proposal) throw error(404, 'No such proposal');
	return proposal;
}
