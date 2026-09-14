import { error } from '@sveltejs/kit';
import { Main } from '@daml.js/model';
import { activeContracts, operatorParty, providerParty, submitAsProvider } from './participant';

/**
 * The app's own state on the ledger: one `AppProxy` per user, created by the provider.
 *
 * The proxy is what makes the provider a confirmer of every user transaction — see Main.daml —
 * and, since the operator observes all of them, together they are the directory that lets one
 * user name another. Reads go through the operator; the provider only ever signs.
 */

/** Every party id this app allocates carries this hint; the key's fingerprint tells them apart. */
export const PARTY_HINT = 'syncvotes';

export type Entry = { contractId: string; party: string; name: string };

export async function directory(): Promise<Entry[]> {
	const proxies = await activeContracts<{ user: string; name: string }>(
		operatorParty(),
		Main.AppProxy.templateId
	);
	return proxies.map((p) => ({
		contractId: p.contractId,
		party: p.payload.user,
		name: p.payload.name
	}));
}

export async function entryFor(party: string): Promise<Entry> {
	const entry = (await directory()).find((e) => e.party === party);
	if (!entry) throw error(404, 'This party is not registered with the app');
	return entry;
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
export async function register(party: string, name: string): Promise<Entry> {
	const entries = await directory();

	const mine = entries.find((e) => e.party === party);
	if (mine) return mine;

	if (entries.some((e) => e.name === name)) throw error(409, `The name "${name}" is taken`);

	await submitAsProvider(
		[
			{
				CreateCommand: {
					templateId: Main.AppProxy.templateId,
					createArguments: {
						provider: providerParty(),
						user: party,
						name,
						operator: operatorParty()
					}
				}
			}
		],
		`register-${name}-${Date.now()}`
	);

	return entryFor(party);
}
