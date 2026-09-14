import { error } from '@sveltejs/kit';
import { SDK } from '@canton-network/wallet-sdk';
import {
	LEDGER_API_URL,
	PROVIDER_PARTY,
	OPERATOR_PARTY,
	LEDGER_USER_ID,
	LEDGER_AUTH_AUDIENCE,
	LEDGER_AUTH_SECRET
} from '$app/env/private';

/**
 * The server's side of the ledger, through the Canton wallet SDK. It holds the participant
 * credentials and does everything the user's key cannot: reads the ACS, prepares transactions,
 * forwards signed ones, and signs as the provider where the model needs it.
 *
 * User parties are external: hosted here, so our package is available and this participant
 * confirms for them — which is what earns traffic rewards — but signed only by a key the user
 * holds. Nothing in this file can act for a user on its own.
 */

function required(name: string, value: string | undefined): string {
	if (!value) throw error(500, `Environment variable ${name} is not set`);
	return value;
}

export const providerParty = () => required('PROVIDER_PARTY', PROVIDER_PARTY);
export const operatorParty = () => required('OPERATOR_PARTY', OPERATOR_PARTY);

type Sdk = Awaited<ReturnType<typeof SDK.create>>;
let instance: Promise<Sdk> | undefined;

/** One SDK for the process. `self_signed` is the validator's dev-mode HS256 auth. */
export function sdk(): Promise<Sdk> {
	return (instance ??= SDK.create({
		ledgerClientUrl: required('LEDGER_API_URL', LEDGER_API_URL),
		auth: {
			method: 'self_signed',
			issuer: 'syncvotes',
			credentials: {
				clientId: required('LEDGER_USER_ID', LEDGER_USER_ID),
				clientSecret: required('LEDGER_AUTH_SECRET', LEDGER_AUTH_SECRET),
				audience: required('LEDGER_AUTH_AUDIENCE', LEDGER_AUTH_AUDIENCE),
				scope: ''
			}
		},
		logAdapter: 'console'
	}));
}

/** Active contracts of one template, as seen by a party this participant hosts. */
export async function activeContracts<T>(
	party: string,
	templateId: string
): Promise<{ contractId: string; payload: T }[]> {
	const contracts = await (
		await sdk()
	).ledger.acs.read({
		parties: [party],
		templateIds: [templateId],
		filterByParty: true
	});

	return contracts.map((c) => ({ contractId: c.contractId, payload: c.createArgument as T }));
}

export type Commands = Parameters<Sdk['ledger']['internal']['submit']>[0]['commands'];

/** Submits as the provider — the one local party, used only to create proxies. */
export async function submitAsProvider(commands: Commands, commandId: string) {
	return (await sdk()).ledger.internal.submit({ commands, actAs: [providerParty()], commandId });
}

// ---- External parties ---------------------------------------------------------------------

export type Topology = {
	partyId: string;
	publicKeyFingerprint: string;
	multiHash: string;
	topologyTransactions: string[];
};

/**
 * Asks the participant to lay out the party for this key: the party id, and the hash the key has
 * to sign for the party to exist. Nothing is committed — it is also how a returning key finds out
 * which party it is.
 */
export async function generateTopology(hint: string, publicKey: string): Promise<Topology> {
	return (await sdk()).party.external.create(publicKey, { partyHint: hint }).topology();
}

/**
 * Creates the party. The topology is generated again — it is a pure function of hint and key —
 * and the hash is compared to the one the client signed, so a signature can only ever commit
 * what the key actually saw.
 */
export async function allocateExternal(
	hint: string,
	publicKey: string,
	signedMultiHash: string,
	signature: string
): Promise<Topology> {
	const creation = (await sdk()).party.external.create(publicKey, { partyHint: hint });

	const { multiHash } = await creation.topology();
	if (multiHash !== signedMultiHash) {
		throw error(409, 'The party topology changed since it was signed — sign in again');
	}

	// The backend user gets no rights on the party. It needs none: prepare, execute and ACS
	// reads all work without them, and a `CanActAs` it does not hold is one it cannot misuse.
	return creation.execute(signature, { grantUserRights: false });
}

/** A party the participant knows is connected to at least one synchronizer. */
export async function partyExists(party: string): Promise<boolean> {
	try {
		const { connectedSynchronizers } = await (await sdk()).ledger.connectedSynchronizers({ party });
		return (connectedSynchronizers?.length ?? 0) > 0;
	} catch {
		return false;
	}
}

export type Prepared = {
	preparedTransaction: string;
	preparedTransactionHash: string;
	hashingSchemeVersion: string;
};

/** Step one of a user transaction: the participant builds it and hands back the hash to sign. */
export async function prepare(party: string, commands: unknown[]): Promise<Prepared> {
	const { response } = await (await sdk()).ledger.prepare({ partyId: party, commands }).toJSON();
	return response;
}

/**
 * Step two: the signed hash goes back and the participant submits. The SDK takes the signing key
 * fingerprint from the party id — for an external party the namespace is its own key.
 */
export async function execute(party: string, prepared: Prepared, signature: string): Promise<void> {
	const ledger = (await sdk()).ledger;
	await ledger.execute(
		ledger.fromSignature(prepared as Parameters<typeof ledger.fromSignature>[0], signature),
		{ partyId: party }
	);
}
