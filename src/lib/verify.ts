import {
	computeMultiHashForTopology,
	computeSha256CantonHash,
	decodePreparedTransaction,
	hashPreparedTransaction
} from '@canton-network/core-tx-visualizer';
import { BinaryReader, WireType } from '@protobuf-ts/runtime';
import type { Value } from '@canton-network/core-ledger-proto';
import { Main, packageId } from '@daml.js/model';
import { fromBase64, toBase64 } from './wallet';

/**
 * What the key is about to sign, checked against what the user meant.
 *
 * The server prepares transactions and hands back a hash; the key signs the hash. Without these
 * checks the browser would sign whatever hash it was given. With them, a hash is only signed if
 * the bytes it commits to were decoded here and say exactly what the user asked for: at sign-up,
 * a party in the key's own namespace, held by this key alone, hosted for confirmation only; on
 * every action, the asked-for choice on the asked-for contract of this app's package, with the
 * asked-for arguments, acting as the user's party alone. The hashing is the SDK's own.
 */

// Hash purposes from Canton's hashing scheme v2, as the SDK's `utils.hash.topologyTransaction`
// and `keys.fingerprint`.
const TOPOLOGY_TRANSACTION = 11;
const TOPOLOGY_MULTI_HASH = 55;
const PUBLIC_KEY_FINGERPRINT = 12;

// Wire values from the topology proto: TOPOLOGY_CHANGE_OP_ADD_REPLACE, PARTICIPANT_PERMISSION_*,
// SIGNING_KEY_SPEC_EC_CURVE25519.
const ADD_REPLACE = 1;
const CONFIRMATION = 2;
const EC_CURVE25519 = 1;

/** The package this app was built with; a same-named choice elsewhere is refused. */
export const PACKAGE_NAME = Main.Account.templateId.slice(1).split(':')[0];

type Home = { template: string; pkg: string };

/** The only choices a user is ever asked to sign, and where each lives. */
const CHOICES: Record<string, Home> = {
	Account_CreateDAO: { template: 'Main:Account', pkg: PACKAGE_NAME },
	Account_SetProfile: { template: 'Main:Account', pkg: PACKAGE_NAME },
	Member_Propose: { template: 'Main:Member', pkg: PACKAGE_NAME },
	Member_Vote: { template: 'Main:Member', pkg: PACKAGE_NAME },
	Member_Comment: { template: 'Main:Member', pkg: PACKAGE_NAME }
};

// ---- Sign-up: the party topology --------------------------------------------------------

/** Canton's fingerprint of a public key: a multihash of a purpose-prefixed SHA-256. */
export async function fingerprintOf(publicKey: Uint8Array): Promise<string> {
	const input = new Uint8Array(4 + publicKey.length);
	input[3] = PUBLIC_KEY_FINGERPRINT;
	input.set(publicKey, 4);
	const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
	return '1220' + [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A protobuf message as its raw fields, in wire order. The proto packages available do not know
 * the field that matters most here — the party's signing keys — so the bytes are read directly,
 * by field number, with the SDK's own reader. Nothing is guessed: every field is either checked
 * or refused.
 */
type Field = { number: number; wire: WireType; value: Uint8Array | bigint };

function fields(bytes: Uint8Array): Field[] {
	const reader = new BinaryReader(bytes);
	const out: Field[] = [];
	while (reader.pos < reader.len) {
		const [number, wire] = reader.tag();
		if (wire === WireType.Varint) out.push({ number, wire, value: reader.uint64().toBigInt() });
		else if (wire === WireType.LengthDelimited) out.push({ number, wire, value: reader.bytes() });
		else throw new Error(`Unexpected wire type ${wire} in field ${number}`);
	}
	return out;
}

const only = (list: Field[], allowed: number[]) => {
	const stray = list.find((f) => !allowed.includes(f.number));
	if (stray) throw new Error(`Unexpected field ${stray.number} in the party topology`);
};
const one = (list: Field[], number: number, what: string): Field => {
	const found = list.filter((f) => f.number === number);
	if (found.length !== 1) throw new Error(`Expected exactly one ${what} in the party topology`);
	return found[0];
};
const bytesOf = (f: Field) => (f.value instanceof Uint8Array ? f.value : new Uint8Array());
const text = (f: Field) => new TextDecoder().decode(bytesOf(f));
const num = (f: Field) => (typeof f.value === 'bigint' ? Number(f.value) : NaN);

const sameKey = (stored: Uint8Array, own: Uint8Array) =>
	// Raw, or wrapped in a DER SubjectPublicKeyInfo: the key bytes are the tail either way.
	(stored.length === own.length || stored.length === own.length + 12) &&
	stored.subarray(stored.length - own.length).every((b, i) => b === own[i]);

export async function verifyTopology(
	topology: { partyId: string; topologyTransactions: string[]; multiHash: string },
	publicKey: Uint8Array,
	hint: string
): Promise<void> {
	const bytes = topology.topologyTransactions.map(fromBase64);

	const hashes = await Promise.all(
		bytes.map((tx) => computeSha256CantonHash(TOPOLOGY_TRANSACTION, tx))
	);
	const combined = await computeMultiHashForTopology(hashes);
	const multiHash = toBase64(await computeSha256CantonHash(TOPOLOGY_MULTI_HASH, combined));
	if (multiHash !== topology.multiHash) {
		throw new Error('The party topology does not match the hash the server asked to sign');
	}

	const namespace = await fingerprintOf(publicKey);
	const party = `${hint}::${namespace}`;
	if (topology.partyId !== party) {
		throw new Error(`The party would be ${topology.partyId}, not ${party}`);
	}

	// Canton 3.5 lays the party out as one transaction: a versioned wrapper around a
	// TopologyTransaction whose mapping is a PartyToParticipant carrying the party's signing keys.
	if (bytes.length !== 1) throw new Error('Expected the party to be one topology transaction');
	const wrapper = fields(bytes[0]);
	only(wrapper, [1, 2]);
	const transaction = fields(bytesOf(one(wrapper, 1, 'transaction')));
	only(transaction, [1, 2, 3]);
	if (num(one(transaction, 1, 'operation')) !== ADD_REPLACE) {
		throw new Error('The party topology is not an addition');
	}
	const mapping = fields(bytesOf(one(transaction, 3, 'mapping')));
	// Field 9 is PartyToParticipant; any other mapping is refused outright.
	const hosting = fields(bytesOf(one(mapping, 9, 'hosting mapping')));
	only(mapping, [9]);
	only(hosting, [1, 2, 3, 6]);

	if (text(one(hosting, 1, 'party')) !== party) throw new Error('The mapping is for another party');
	if (num(one(hosting, 2, 'threshold')) !== 1) throw new Error('The hosting threshold is not one');

	const participant = fields(bytesOf(one(hosting, 3, 'hosting participant')));
	only(participant, [1, 2]);
	if (num(one(participant, 2, 'permission')) !== CONFIRMATION) {
		throw new Error('The participant would get more than confirmation rights over your party');
	}

	// The party's signing keys: exactly this key, and a threshold of one.
	const signing = fields(bytesOf(one(hosting, 6, 'signing key set')));
	only(signing, [1, 2]);
	if (num(one(signing, 2, 'signing threshold')) !== 1)
		throw new Error('The signing threshold is not one');
	const key = fields(bytesOf(one(signing, 1, 'signing key')));
	if (!sameKey(bytesOf(one(key, 3, 'key bytes')), publicKey)) {
		throw new Error('The party would be signable by a key that is not yours');
	}
	if (num(one(key, 6, 'key spec')) !== EC_CURVE25519)
		throw new Error('The signing key is not ed25519');
}

// ---- Every action: the prepared transaction -----------------------------------------------

/** A Daml value, flattened to plain data the way the app writes its choice arguments. */
export type Plain = string | number | boolean | null | Plain[] | { [field: string]: Plain };

function plain(value: Value | undefined): Plain {
	const sum = value?.sum;
	switch (sum?.oneofKind) {
		case 'unit':
			return {};
		case 'bool':
			return sum.bool;
		case 'int64':
			return String(sum.int64);
		case 'numeric':
			return sum.numeric;
		case 'text':
			return sum.text;
		case 'party':
			return sum.party;
		case 'contractId':
			return sum.contractId;
		case 'timestamp':
			// Microseconds since the epoch; the app writes ISO strings with millisecond precision.
			return new Date(Number(BigInt(sum.timestamp) / 1000n)).toISOString();
		case 'date':
			return new Date(sum.date * 86_400_000).toISOString().slice(0, 10);
		case 'enum':
			return sum.enum.constructor;
		case 'variant':
			// As the app writes variants: the constructor as `tag`, its payload as `value`.
			return { tag: sum.variant.constructor, value: plain(sum.variant.value) };
		case 'genMap':
			return sum.genMap.entries.map((e) => [plain(e.key), plain(e.value)]);
		case 'textMap':
			return Object.fromEntries(sum.textMap.entries.map((e) => [e.key, plain(e.value)]));
		case 'optional':
			return sum.optional.value ? plain(sum.optional.value) : null;
		case 'list':
			return sum.list.elements.map(plain);
		case 'record':
			return Object.fromEntries(sum.record.fields.map((f) => [f.label, plain(f.value)]));
		default:
			throw new Error(`Cannot read a ${sum?.oneofKind ?? 'missing'} value`);
	}
}

/**
 * Whether `actual` says everything `expected` says. Records may carry more than the page
 * asked about (a coin transfer names the participant's choice of inputs and its timestamps);
 * lists must match exactly.
 */
function covers(expected: Plain, actual: Plain): boolean {
	if (Array.isArray(expected) || Array.isArray(actual)) {
		return (
			Array.isArray(expected) &&
			Array.isArray(actual) &&
			expected.length === actual.length &&
			expected.every((x, i) => covers(x, actual[i]))
		);
	}
	if (
		expected !== null &&
		actual !== null &&
		typeof expected === 'object' &&
		typeof actual === 'object'
	) {
		// A field that is None may be left out of the record altogether.
		return Object.keys(expected).every((k) =>
			k in actual ? covers(expected[k], actual[k]) : expected[k] === null
		);
	}
	// Timestamps come as ISO text from two writers (the ledger drops trailing zeros); the
	// instant is what has to match.
	if (
		typeof expected === 'string' &&
		typeof actual === 'string' &&
		ISO.test(expected) &&
		ISO.test(actual)
	) {
		return Date.parse(expected) === Date.parse(actual);
	}
	return expected === actual;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export type Expected = {
	/** The party the transaction acts as: the signer's own. */
	party: string;
	choice: string;
	/** The contract the choice is on, when the page knows it; a transfer's factory it does not. */
	contractId?: string;
	args: { [field: string]: Plain };
};

/**
 * A prepared transaction is signed only if it acts as the expected party alone, and each of
 * its roots is the expected choice on the expected contract with the expected arguments, in
 * the expected package. Whatever hangs below a root is the choice's own body, authorised by
 * that contract's signatories, not by us. (Who the transaction reads as is not in the signed
 * bytes; reading changes nothing about what the signature authorises.)
 */
export async function verifyPrepared(
	prepared: { preparedTransaction: string; preparedTransactionHash: string },
	expected: Expected | Expected[]
): Promise<void> {
	const hash = await hashPreparedTransaction(prepared.preparedTransaction, 'base64');
	if (hash !== prepared.preparedTransactionHash) {
		throw new Error('The transaction does not match the hash the server asked to sign');
	}
	const intents = Array.isArray(expected) ? expected : [expected];
	const party = intents[0].party;

	const tx = decodePreparedTransaction(prepared.preparedTransaction);

	// The signature authorises exactly the submitter's actAs — so that must be the party, alone.
	const actAs = tx.metadata?.submitterInfo?.actAs ?? [];
	if (actAs.length !== 1 || actAs[0] !== party) {
		throw new Error(`The transaction acts as ${actAs.join(', ') || 'nobody'}, not ${party}`);
	}

	const nodes = tx.transaction?.nodes ?? [];
	const roots = tx.transaction?.roots ?? [];
	const byId = new Map(nodes.map((node) => [node.nodeId, node]));
	if (roots.length !== intents.length) {
		throw new Error(`Expected ${intents.length} choice(s), the transaction has ${roots.length}`);
	}

	roots.forEach((rootId, i) => {
		const want = intents[i];
		const root = byId.get(rootId)?.versionedNode;
		if (root?.oneofKind !== 'v1' || root.v1.nodeType.oneofKind !== 'exercise') {
			throw new Error('Expected a choice exercise, got something else');
		}
		const exercise = root.v1.nodeType.exercise;
		const home = CHOICES[want.choice];
		const template = `${exercise.templateId?.moduleName}:${exercise.templateId?.entityName}`;
		if (!home || exercise.choiceId !== want.choice || template !== home.template) {
			throw new Error(
				`Expected to sign ${want.choice} on ${home?.template}, got ${exercise.choiceId} on ${template}`
			);
		}
		// Every choice a user signs is on the app's own template directly; one reached through an
		// interface would be some other package's code under a familiar name.
		if (exercise.interfaceId) throw new Error('The choice is reached through an interface');
		if (exercise.packageName !== home.pkg) {
			throw new Error(`The transaction uses ${exercise.packageName}, not ${home.pkg}`);
		}
		if (home.pkg === PACKAGE_NAME && exercise.templateId?.packageId !== packageId) {
			throw new Error('The transaction uses a package this app was not built with');
		}
		if (want.contractId !== undefined && exercise.contractId !== want.contractId) {
			throw new Error('The transaction is on a different contract than the one you are looking at');
		}
		if (exercise.actingParties.some((p) => p !== party)) {
			throw new Error(
				`The choice would be exercised by ${exercise.actingParties.join(', ')}, not ${party}`
			);
		}
		const got = plain(exercise.chosenValue);
		if (!covers(want.args, got)) {
			throw new Error(
				`The transaction does not say what you asked for: it says ${JSON.stringify(got).slice(0, 400)}, you asked for ${JSON.stringify(want.args).slice(0, 400)}`
			);
		}
	});
}
