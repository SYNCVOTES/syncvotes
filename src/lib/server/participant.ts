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
	LEDGER_AUTH_SCOPE,
	SCAN_URL
} from '$app/env/private';

/**
 * The participant, through the Canton wallet SDK and its JSON Ledger API: party allocation, the
 * active contracts, the update stream, and the two halves of a user transaction (prepare here,
 * execute here, sign in the browser in between). User parties are external: hosted on this
 * participant so the app's package is available to them, but signable only by keys the users
 * hold. The app's ledger user has no rights on user parties, so nothing in this file can act
 * for a user on its own; it reads as the operator, which observes every contract of the app.
 */

function required(name: string, value: string | undefined): string {
	if (!value) throw error(500, `Environment variable ${name} is not set`);
	return value;
}

export const providerParty = () => required('PROVIDER_PARTY', PROVIDER_PARTY);
export const operatorParty = () => required('OPERATOR_PARTY', OPERATOR_PARTY);
export const ledgerUrl = () => required('LEDGER_API_URL', LEDGER_API_URL);
export const scanUrl = () => required('SCAN_URL', SCAN_URL).replace(/\/$/, '');

export const auth = () =>
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
	const url = ledgerUrl();
	const base = await SDK.create({ ledgerClientUrl: url, auth: auth(), logAdapter });
	const events = await base.extend({
		events: { websocketURL: url.replace(/^http/, 'ws'), auth: auth() }
	});
	// The token standard, against the network's public Scan: holdings and transfer commands.
	return events.extend({ token: { auth: auth(), registries: [scanUrl()], registryAuth: 'none' } });
}

type Sdk = Awaited<ReturnType<typeof create>>;
let instance: Promise<Sdk> | undefined;

export const sdk = (): Promise<Sdk> => (instance ??= create());

/** The app's ledger user, as the token names it. */
export async function userId(): Promise<string> {
	const jwt = await token();
	return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub as string;
}

async function token(): Promise<string> {
	const ledger = await sdk();
	const tokens = (
		ledger.events as unknown as {
			websocketClient: { accessTokenProvider: { getAccessToken(): Promise<string> } };
		}
	).websocketClient.accessTokenProvider;
	return tokens.getAccessToken();
}

/** The JSON Ledger API, for what the SDK does not wrap. Errors carry the participant's text. */
export async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
	const response = await fetch(ledgerUrl() + path, {
		method: body === undefined ? 'GET' : 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const text = await response.text();
	if (!response.ok) throw new Error(`${path} ${response.status}: ${text.slice(0, 600)}`);
	return text ? (JSON.parse(text) as T) : (undefined as T);
}

let synchronizer: Promise<string> | undefined;

/** The synchronizer the provider is on: the one every party here is on. */
export const synchronizerId = (): Promise<string> =>
	(synchronizer ??= api<{ connectedSynchronizers: { synchronizerId: string }[] }>(
		`/v2/state/connected-synchronizers?party=${encodeURIComponent(providerParty())}`
	).then((r) => r.connectedSynchronizers[0].synchronizerId));

export type Created = {
	contractId: string;
	templateId: string;
	createArgument: Record<string, unknown>;
	createdEventBlob?: string;
};

/**
 * Every active contract of these templates as `party` sees them at `offset`. The JSON API's
 * list endpoint stops at a couple of hundred contracts; its websocket streams them all.
 */
export async function streamActiveContracts(
	party: string,
	templateIds: string[],
	offset: number,
	onContract: (c: Created) => void,
	includeBlob = false
): Promise<void> {
	const jwt = await token();
	const url = ledgerUrl().replace(/^http/, 'ws') + '/v2/state/active-contracts';
	const filtersByParty = {
		[party]: {
			cumulative: templateIds.map((templateId) => ({
				identifierFilter: {
					TemplateFilter: { value: { templateId, includeCreatedEventBlob: includeBlob } }
				}
			}))
		}
	};

	await new Promise<void>((resolve, reject) => {
		const ws = new WebSocket(url, [`jwt.token.${jwt}`, 'daml.ws.auth']);
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

/** What `party` holds of these templates right now. */
export async function activeContracts(
	party: string,
	templateIds: string[],
	includeBlob = false
): Promise<Created[]> {
	const offset = await (await sdk()).ledger.ledgerEnd();
	const found: Created[] = [];
	await streamActiveContracts(party, templateIds, offset, (c) => found.push(c), includeBlob);
	return found;
}

export type DisclosedContract = {
	templateId: string;
	contractId: string;
	createdEventBlob: string;
	synchronizerId: string;
};

export type Commands = Parameters<Sdk['ledger']['internal']['submit']>[0]['commands'];

/** The provider's own writes: Accounts, counting, carrying out passed proposals, meters. */
export async function submitAsProvider(
	commands: Commands,
	commandId: string,
	disclosedContracts: DisclosedContract[] = []
): Promise<string> {
	try {
		const { updateId } = await (
			await sdk()
		).ledger.internal.submit({
			commands,
			actAs: [providerParty()],
			commandId,
			disclosedContracts
		});
		return updateId;
	} catch (e) {
		ledgerError(e);
	}
}

/**
 * The traffic this participant paid for a transaction it submitted, in bytes — asked for as
 * the submitting party, which is the only view that carries the figure. Zero if unknown.
 */
export async function paidTraffic(updateId: string, party: string): Promise<number> {
	try {
		const r = await api<{ update?: { Transaction?: { value?: { paidTrafficCost?: number } } } }>(
			'/v2/updates/update-by-id',
			{
				updateId,
				updateFormat: {
					includeTransactions: {
						eventFormat: {
							filtersByParty: {
								[party]: { cumulative: [{ identifierFilter: { WildcardFilter: { value: {} } } }] }
							},
							verbose: false
						},
						transactionShape: 'TRANSACTION_SHAPE_ACS_DELTA'
					}
				}
			}
		);
		return Number(r.update?.Transaction?.value?.paidTrafficCost ?? 0);
	} catch {
		return 0;
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

/** The bytes a party's topology puts on the wire: what its allocation costs in traffic. */
export const topologyBytes = (topology: { topologyTransactions: string[] }) =>
	topology.topologyTransactions.reduce((n, t) => n + Buffer.from(t, 'base64').length, 0) + 128;

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

export type Signature = { fingerprint: string; signature: string };

/** A party owned by several keys, from hand-built topology transactions signed by its owners. */
export async function allocateMultiKeyParty(
	transactions: string[],
	signatures: Signature[]
): Promise<void> {
	await api('/v2/parties/external/allocate', {
		synchronizer: await synchronizerId(),
		identityProviderId: '',
		onboardingTransactions: transactions.map((transaction) => ({ transaction })),
		multiHashSignatures: signatures.map(wire)
	});
}

/**
 * A party this participant hosts whose namespace is this fingerprint: the party a key made,
 * found without its Account — for a key that comes back after the app's package changed. Read
 * from the list kept below; empty until the first walk of the participant's parties is done.
 */
export const partyByFingerprint = (fingerprint: string): string | null =>
	hosted.get(fingerprint) ?? null;

/** The parties this participant hosts, by fingerprint. */
const hosted = new Map<string, string>();
let walking = false;

/**
 * The participant lists every party it has heard of — on MainNet the whole network, well over
 * fifty thousand — so the walk is done in the background, once at start and then every ten
 * minutes, and never on a request. Only hosted parties are kept.
 */
export async function refreshHostedParties(): Promise<void> {
	if (walking) return;
	walking = true;
	try {
		const found = new Map<string, string>();
		let token: string | undefined;
		do {
			const page = await api<{
				partyDetails: { party: string; isLocal: boolean }[];
				nextPageToken?: string;
			}>(`/v2/parties?pageSize=1000${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`);
			for (const p of page.partyDetails) {
				if (p.isLocal) found.set(p.party.split('::')[1] ?? '', p.party);
			}
			token = page.nextPageToken || undefined;
		} while (token);
		hosted.clear();
		for (const [k, v] of found) hosted.set(k, v);
	} catch (e) {
		console.warn('Hosted parties not read:', e instanceof Error ? e.message : e);
	} finally {
		walking = false;
	}
}

/** Whether the synchronizer knows this party yet. */
export const partyKnown = (party: string): Promise<boolean> =>
	api<{ connectedSynchronizers?: unknown[] }>(
		`/v2/state/connected-synchronizers?party=${encodeURIComponent(party)}`
	).then(
		(r) => (r.connectedSynchronizers?.length ?? 0) > 0,
		() => false
	);

const wire = ({ fingerprint, signature }: Signature) => ({
	format: 'SIGNATURE_FORMAT_CONCAT',
	signature,
	signedBy: fingerprint,
	signingAlgorithmSpec: 'SIGNING_ALGORITHM_SPEC_ED25519'
});

// ---- User transactions --------------------------------------------------------------------

export type Prepared = {
	preparedTransaction: string;
	preparedTransactionHash: string;
	hashingSchemeVersion: string;
	/** The participant's estimate of the traffic the transaction will cost, in bytes. */
	cost: number;
};

/**
 * Hashes this server prepared, for a while. Only these are ever executed, so a caller cannot
 * hand in a transaction of their own making and skip the rules the prepare functions enforce.
 * The DAO named here is the one billed for the traffic.
 */
const prepared = new Map<string, { party: string; payer: string | null; at: number }>();
const PREPARED_TTL = 10 * 60 * 1000;

/**
 * Step one of a user transaction: the participant builds it and hands back the hash to sign.
 * The operator reads alongside the acting party, so a member's transaction can look at the
 * DAO's own contracts; the browser checks that nothing else is read as.
 */
export async function prepare(
	party: string,
	commands: unknown[],
	options: {
		/** The account charged for it once it is executed: `dao:<id>` or `purse:<fingerprint>`. */
		payer?: string | null;
		disclosedContracts?: DisclosedContract[];
		signatures?: number;
	} = {}
): Promise<Prepared> {
	try {
		const response = await api<{
			preparedTransaction: string;
			preparedTransactionHash: string;
			hashingSchemeVersion: string;
			costEstimation?: { totalTrafficCostEstimation?: number };
		}>('/v2/interactive-submission/prepare', {
			userId: await userId(),
			commandId: crypto.randomUUID(),
			actAs: [party],
			readAs: [operatorParty()],
			commands,
			disclosedContracts: options.disclosedContracts ?? [],
			synchronizerId: await synchronizerId(),
			verboseHashing: false,
			packageIdSelectionPreference: [],
			estimateTrafficCost: {
				disabled: false,
				expectedSignatures: Array.from(
					{ length: options.signatures ?? 1 },
					() => 'SIGNING_ALGORITHM_SPEC_ED25519'
				)
			}
		});
		const now = Date.now();
		for (const [hash, p] of prepared) if (now - p.at > PREPARED_TTL) prepared.delete(hash);
		prepared.set(response.preparedTransactionHash, {
			party,
			payer: options.payer ?? null,
			at: now
		});
		return {
			preparedTransaction: response.preparedTransaction,
			preparedTransactionHash: response.preparedTransactionHash,
			hashingSchemeVersion: response.hashingSchemeVersion,
			cost: Number(response.costEstimation?.totalTrafficCostEstimation ?? 0)
		};
	} catch (e) {
		ledgerError(e);
	}
}

/** Which DAO a prepared transaction belongs to, if it was prepared here. */
export const preparedFor = (hash: string) => prepared.get(hash);

/**
 * Step two: the signed hash comes back — one signature, or as many as the party's threshold
 * asks — and the participant submits. Resolves with the id of the resulting transaction once
 * the ledger has accepted it.
 */
export async function execute(
	party: string,
	tx: Omit<Prepared, 'cost'>,
	signatures: Signature[]
): Promise<string> {
	const known = prepared.get(tx.preparedTransactionHash);
	if (!known || known.party !== party) throw error(400, 'Nothing was prepared for this signature');
	prepared.delete(tx.preparedTransactionHash);
	try {
		const { updateId } = await api<{ updateId: string }>(
			'/v2/interactive-submission/executeAndWait',
			{
				userId: await userId(),
				preparedTransaction: tx.preparedTransaction,
				hashingSchemeVersion: tx.hashingSchemeVersion,
				submissionId: crypto.randomUUID(),
				deduplicationPeriod: { Empty: {} },
				partySignatures: { signatures: [{ party, signatures: signatures.map(wire) }] }
			}
		);
		return updateId;
	} catch (e) {
		ledgerError(e);
	}
}

/**
 * The ledger's rejection, as the user should read it: the Daml assertion that failed ("Already
 * voted", "The deadline has passed"), or that the contract changed under them.
 */
export function ledgerError(e: unknown): never {
	if (typeof e === 'object' && e !== null && 'status' in e && 'body' in e) throw e;
	// The participant's own errors are plain objects: a `code` (CONTRACT_NOT_ACTIVE,
	// DUPLICATE_COMMAND…) and a `cause`; the code leads, so a caller can tell them apart.
	const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
	const text =
		e instanceof Error
			? e.message
			: typeof e === 'object' && e !== null
				? String(
						(e as { message?: unknown; cause?: unknown }).message ??
							(e as { cause?: unknown }).cause ??
							JSON.stringify(e)
					)
				: String(e);
	const message = typeof code === 'string' && !text.includes(code) ? `${code}: ${text}` : text;
	if (/CONTRACT_NOT_ACTIVE|INACTIVE_CONTRACT|LOCKED_CONTRACT|CONTRACT_NOT_FOUND/.test(message)) {
		error(409, 'This changed while you were looking at it — reload and try again');
	}
	if (/NOT_SEQUENCED_TIMEOUT/.test(message)) {
		error(409, 'The signatures took too long; the transaction has to be prepared again');
	}
	const reason =
		message.match(/DAML_INTERPRETATION_ERROR[^:]*: [^\n]*?Error: ([^\n"]{1,200})/)?.[1] ??
		message.match(/UNHANDLED_EXCEPTION[^:]*: ([^\n"]{1,200})/)?.[1] ??
		message.match(/\(error category 9\): ([^\n"\\]{1,200})/)?.[1];
	error(400, reason ?? message.slice(0, 300));
}
