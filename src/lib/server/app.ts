import { error } from '@sveltejs/kit';
import { Main } from '@daml.js/model';
import { activeContracts, operatorParty, providerParty, submitAsProvider } from './participant';

/**
 * The app's own view of the ledger, read as the operator: it observes every Account, DAO and
 * Proposal, so it can list them for a member and resolve names to parties. Nothing here writes
 * on a user's behalf — the one write, creating an Account, is the provider's own signature.
 */

/** Every party id this app allocates carries this hint; the key's fingerprint tells them apart. */
export const PARTY_HINT = 'syncvotes';

export type Account = { contractId: string; party: string; name: string };
export type Dao = {
	contractId: string;
	admin: string;
	name: string;
	description: string;
	members: string[];
};
export type Ballot = { voter: string; vote: 'Yes' | 'No' };
export type Proposal = {
	contractId: string;
	dao: string;
	daoName: string;
	proposer: string;
	title: string;
	description: string;
	members: string[];
	closesAt: string;
	ballots: Ballot[];
	outcome: 'Passed' | 'Failed' | null;
};

const read = <T>(templateId: string) => activeContracts<T>(operatorParty(), templateId);

export async function accounts(): Promise<Account[]> {
	const found = await read<{ user: string; name: string }>(Main.Account.templateId);
	return found.map((c) => ({ contractId: c.contractId, party: c.payload.user, name: c.payload.name }));
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
		`register-${name}-${Date.now()}`
	);

	return accountOf(party);
}

type DaoPayload = { admin: string; name: string; description: string; members: string[] };

export async function daos(): Promise<Dao[]> {
	const found = await read<DaoPayload>(Main.DAO.templateId);
	return found.map((c) => ({ contractId: c.contractId, ...c.payload }));
}

export async function daoById(contractId: string): Promise<Dao> {
	const dao = (await daos()).find((d) => d.contractId === contractId);
	if (!dao) throw error(404, 'No such DAO');
	return dao;
}

type ProposalPayload = Omit<Proposal, 'contractId' | 'outcome'> & {
	outcome: 'Passed' | 'Failed' | null | undefined;
};

export async function proposals(): Promise<Proposal[]> {
	const found = await read<ProposalPayload>(Main.Proposal.templateId);
	return found.map((c) => ({ contractId: c.contractId, ...c.payload, outcome: c.payload.outcome ?? null }));
}

export async function proposalById(contractId: string): Promise<Proposal> {
	const proposal = (await proposals()).find((p) => p.contractId === contractId);
	if (!proposal) throw error(404, 'No such proposal');
	return proposal;
}
