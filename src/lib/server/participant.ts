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
 * The participant, through the Canton wallet SDK: party allocation, the active contracts, the
 * update stream, and the two halves of a user transaction (prepare here, execute here, sign in
 * the browser in between). User parties are external: hosted on this participant so the app's
 * package is available to them, but signable only by a key the user holds. The app's ledger
 * user has no rights on user parties, so nothing in this file can act for a user on its own.
 */

function required(name: string, value: string | undefined): string {
	if (!value) throw error(500, `Environment variable ${name} is not set`);
	return value;
}

export const providerParty = () => required('PROVIDER_PARTY', PROVIDER_PARTY);
export const operatorParty = () => required('OPERATOR_PARTY', OPERATOR_PARTY);

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

// The SDK logs whole token responses at info level; only warnings and errors get through.
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
	return base.extend({ events: { websocketURL: url.replace(/^http/, 'ws'), auth: auth() } });
}

type Sdk = Awaited<ReturnType<typeof create>>;
let instance: Promise<Sdk> | undefined;

export const sdk = (): Promise<Sdk> => (instance ??= create());

export type Created = {
	contractId: string;
	templateId: string;
	createArgument: Record<string, unknown>;
};

/**
 * Every active contract of these templates as `party` sees them at `offset`. The JSON API's
 * list endpoint stops at a couple of hundred contracts; its websocket streams them all.
 */
export async function streamActiveContracts(
	party: string,
	templateIds: string[],
	offset: number,
	onContract: (c: Created) => void
): Promise<void> {
	const ledger = await sdk();
	const tokens = (
		ledger.events as unknown as {
			websocketClient: { accessTokenProvider: { getAccessToken(): Promise<string> } };
		}
	).websocketClient.accessTokenProvider;
	const token = await tokens.getAccessToken();
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

/** The provider's own writes: an Account for a new party, and counting ballots. */
export async function submitAsProvider(commands: Commands, commandId: string): Promise<string> {
	try {
		const { updateId } = await (
			await sdk()
		).ledger.internal.submit({ commands, actAs: [providerParty()], commandId });
		return updateId;
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
 * The party this key would be under this hint, and the hash the key has to sign for it to
 * exist. Nothing is committed: this is also how a returning key learns which party it is.
 */
export async function partyTopology(hint: string, publicKey: string): Promise<Topology> {
	return (await sdk()).party.external.create(publicKey, { partyHint: hint }).topology();
}

/**
 * Creates the party. The topology is a pure function of hint and key, so it is generated
 * again and its hash compared with the one the key signed: a signature can only ever commit
 * what the key actually saw.
 */
export async function allocateParty(
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
	// The app's ledger user gets no rights on the party itself: reading and executing come from
	// the participant-wide rights it was set up with, and a CanActAs it does not hold is one it
	// cannot misuse.
	return creation.execute(signature, { grantUserRights: false });
}

// ---- User transactions --------------------------------------------------------------------

export type Prepared = {
	preparedTransaction: string;
	preparedTransactionHash: string;
	hashingSchemeVersion: string;
};

/**
 * Hashes this server prepared, for a while. Only these are ever executed, so a caller cannot
 * hand in a transaction of their own making and skip the rules the prepare functions enforce.
 */
const prepared = new Map<string, { party: string; at: number }>();
const PREPARED_TTL = 10 * 60 * 1000;

/** Step one of a user transaction: the participant builds it and hands back the hash to sign. */
export async function prepare(party: string, commands: unknown[]): Promise<Prepared> {
	try {
		const { response } = await (await sdk()).ledger.prepare({ partyId: party, commands }).toJSON();
		const now = Date.now();
		for (const [hash, p] of prepared) if (now - p.at > PREPARED_TTL) prepared.delete(hash);
		prepared.set(response.preparedTransactionHash, { party, at: now });
		return response;
	} catch (e) {
		ledgerError(e);
	}
}

/**
 * Step two: the signed hash comes back and the participant submits. Resolves with the id of
 * the resulting transaction once the ledger has accepted it.
 */
export async function execute(party: string, tx: Prepared, signature: string): Promise<string> {
	const known = prepared.get(tx.preparedTransactionHash);
	if (!known || known.party !== party) throw error(400, 'Nothing was prepared for this signature');
	prepared.delete(tx.preparedTransactionHash);
	try {
		const ledger = (await sdk()).ledger;
		const signed = ledger.fromSignature(
			tx as Parameters<typeof ledger.fromSignature>[0],
			signature
		);
		const { updateId } = await ledger.execute(signed, { partyId: party });
		return updateId;
	} catch (e) {
		ledgerError(e);
	}
}

/**
 * The ledger's rejection, as the user should read it: the Daml assertion that failed ("Already
 * voted", "The deadline has passed"), or that the contract changed under them.
 */
function ledgerError(e: unknown): never {
	if (typeof e === 'object' && e !== null && 'status' in e && 'body' in e) throw e;
	const message = e instanceof Error ? e.message : String(e);
	if (/CONTRACT_NOT_ACTIVE|INACTIVE_CONTRACT|LOCKED_CONTRACT|CONTRACT_NOT_FOUND/.test(message)) {
		error(409, 'This changed while you were looking at it — reload and try again');
	}
	const reason = message.match(
		/DAML_INTERPRETATION_ERROR[^:]*: [^\n]*?Error: ([^\n"]{1,200})/
	)?.[1];
	error(400, reason ?? message.slice(0, 300));
}
