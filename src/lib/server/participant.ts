import { error } from '@sveltejs/kit';
import { SDK } from '@canton-network/wallet-sdk';
import {
	LEDGER_API_URL,
	PROVIDER_PARTY,
	OPERATOR_PARTY,
	LEDGER_AUTH_URL,
	LEDGER_AUTH_CLIENT_ID,
	LEDGER_AUTH_CLIENT_SECRET,
	LEDGER_AUTH_AUDIENCE,
	LEDGER_AUTH_SCOPE
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

/** OAuth2 client credentials against the identity provider; the ledger user is the token's `sub`. */
const auth = () =>
	({
		method: 'client_credentials',
		configUrl: required('LEDGER_AUTH_URL', LEDGER_AUTH_URL),
		credentials: {
			clientId: required('LEDGER_AUTH_CLIENT_ID', LEDGER_AUTH_CLIENT_ID),
			clientSecret: required('LEDGER_AUTH_CLIENT_SECRET', LEDGER_AUTH_CLIENT_SECRET),
			audience: required('LEDGER_AUTH_AUDIENCE', LEDGER_AUTH_AUDIENCE),
			scope: LEDGER_AUTH_SCOPE
		}
	}) as const;

/**
 * The SDK logs the whole token response every time it fetches one. Only its warnings and errors
 * get through here, and only as a message — never the context they came with.
 */
const logAdapter = {
	log(level: string, ctx: { error?: unknown; err?: unknown }, message?: string) {
		if (level !== 'warn' && level !== 'error') return;
		const cause = ctx.error ?? ctx.err;
		const detail = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
		console[level](`SDK: ${message ?? ''} ${detail}`.trim());
	}
};

async function create() {
	const url = required('LEDGER_API_URL', LEDGER_API_URL);
	const base = await SDK.create({ ledgerClientUrl: url, auth: auth(), logAdapter });
	// The update stream rides the same JSON API over a websocket.
	return base.extend({ events: { websocketURL: url.replace(/^http/, 'ws'), auth: auth() } });
}

type Sdk = Awaited<ReturnType<typeof create>>;
let instance: Promise<Sdk> | undefined;

/** One SDK for the process. */
export function sdk(): Promise<Sdk> {
	return (instance ??= create());
}

export type Created = {
	contractId: string;
	templateId: string;
	createArgument: Record<string, unknown>;
};

/**
 * Every active contract of these templates as `party` sees them, at `offset`, streamed. The JSON
 * API's list endpoint stops at a couple of hundred elements; its websocket has no such limit, so
 * that is what a full index is built from. The token is the SDK's own.
 */
export async function streamActiveContracts(
	party: string,
	templateIds: string[],
	offset: number,
	onContract: (c: Created) => void
): Promise<void> {
	const ledger = await sdk();
	const provider = (
		ledger.events as unknown as {
			websocketClient: { accessTokenProvider: { getAccessToken(): Promise<string> } };
		}
	).websocketClient.accessTokenProvider;
	const token = await provider.getAccessToken();
	const url =
		required('LEDGER_API_URL', LEDGER_API_URL).replace(/^http/, 'ws') +
		'/v2/state/active-contracts';
	const filtersByParty = {
		[party]: {
			cumulative: templateIds.map((templateId) => ({
				identifierFilter: {
					TemplateFilter: { value: { templateId, includeCreatedEventBlob: false } }
				}
			}))
		}
	};

	await new Promise<void>((resolve, reject) => {
		const ws = new WebSocket(url, [`jwt.token.${token}`, 'daml.ws.auth']);
		let failed: Error | undefined;
		ws.onopen = () =>
			ws.send(
				JSON.stringify({ filter: { filtersByParty }, verbose: false, activeAtOffset: offset })
			);
		ws.onmessage = (m) => {
			const entry = JSON.parse(String(m.data)) as {
				contractEntry?: { JsActiveContract?: { createdEvent?: Created } };
				error?: unknown;
			};
			const created = entry.contractEntry?.JsActiveContract?.createdEvent;
			if (created) onContract(created);
			else if (entry.error) failed = new Error(JSON.stringify(entry.error).slice(0, 300));
		};
		ws.onerror = () => (failed = new Error('The active-contracts stream failed'));
		ws.onclose = (e) =>
			failed
				? reject(failed)
				: e.code === 1000
					? resolve()
					: reject(new Error(`The active-contracts stream closed: ${e.code} ${e.reason}`));
	});
}

export type Commands = Parameters<Sdk['ledger']['internal']['submit']>[0]['commands'];

/** Submits as the provider — the one local party, used only to create accounts. */
export async function submitAsProvider(commands: Commands, commandId: string) {
	try {
		return await (
			await sdk()
		).ledger.internal.submit({ commands, actAs: [providerParty()], commandId });
	} catch (e) {
		ledgerError(e);
	}
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

	// The backend user gets no rights on the party itself. Reading and executing come from the
	// participant-wide rights it was set up with (README, "Authentication"); a `CanActAs` it
	// does not hold is one it cannot misuse.
	return creation.execute(signature, { grantUserRights: false });
}

export type Prepared = {
	preparedTransaction: string;
	preparedTransactionHash: string;
	hashingSchemeVersion: string;
};

/**
 * What this server prepared, by hash, for a little while. Execution is only ever offered for
 * these: a caller cannot hand in a transaction of their own making and have it submitted, so
 * every rule the prepare functions enforce actually holds.
 */
const prepared = new Map<string, { party: string; at: number }>();
const PREPARED_TTL = 10 * 60 * 1000;

function remember(hash: string, party: string) {
	const now = Date.now();
	for (const [key, entry] of prepared) if (now - entry.at > PREPARED_TTL) prepared.delete(key);
	prepared.set(hash, { party, at: now });
}

/**
 * The SDK throws the ledger's rejection as an Error with the reason in its message; that reason
 * is what the user needs to see ("Already voted", "The deadline has passed"). A contract that
 * changed between prepare and execute is the one case worth naming on its own.
 */
function ledgerError(e: unknown): never {
	if (typeof e === 'object' && e !== null && 'status' in e && 'body' in e) throw e;
	const message = e instanceof Error ? e.message : String(e);
	if (/CONTRACT_NOT_ACTIVE|INACTIVE_CONTRACT|LOCKED_CONTRACT|CONTRACT_NOT_FOUND/.test(message)) {
		throw error(409, 'This changed while you were looking at it — reload and try again');
	}
	const reason = message.match(
		/DAML_INTERPRETATION_ERROR[^:]*: [^\n]*?Error: ([^\n"]{1,200})/
	)?.[1];
	throw error(400, reason ?? message.slice(0, 300));
}

/** Step one of a user transaction: the participant builds it and hands back the hash to sign. */
export async function prepare(party: string, commands: unknown[]): Promise<Prepared> {
	try {
		const { response } = await (await sdk()).ledger.prepare({ partyId: party, commands }).toJSON();
		remember(response.preparedTransactionHash, party);
		return response;
	} catch (e) {
		ledgerError(e);
	}
}

/**
 * Step two: the signed hash goes back and the participant submits. The SDK takes the signing key
 * fingerprint from the party id — for an external party the namespace is its own key.
 */
export async function execute(party: string, tx: Prepared, signature: string): Promise<void> {
	const known = prepared.get(tx.preparedTransactionHash);
	if (!known || known.party !== party) throw error(400, 'Nothing was prepared for this signature');
	prepared.delete(tx.preparedTransactionHash);

	try {
		const ledger = (await sdk()).ledger;
		await ledger.execute(
			ledger.fromSignature(tx as Parameters<typeof ledger.fromSignature>[0], signature),
			{ partyId: party }
		);
	} catch (e) {
		ledgerError(e);
	}
}
