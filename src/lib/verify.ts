import {
	computeMultiHashForTopology,
	computeSha256CantonHash,
	decodePreparedTransaction,
	decodeTopologyTransaction,
	hashPreparedTransaction
} from '@canton-network/core-tx-visualizer';
import type { Value } from '@canton-network/core-ledger-proto';
import { packageId } from '@daml.js/model';
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

/** The package every user action must live in; a same-named choice elsewhere is refused. */
const PACKAGE_NAME = 'syncvotes-governance';

/** The only choices a user is ever asked to sign, and the template each lives on. */
export const CHOICES: Record<string, string> = {
	Account_CreateDAO: 'Main:Account',
	DAO_CreateProposal: 'Main:DAO',
	Proposal_Vote: 'Main:Proposal',
	Proposal_Close: 'Main:Proposal'
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

	const seen = new Set<string>();
	for (const tx of topology.topologyTransactions) {
		const decoded = decodeTopologyTransaction(tx);
		const mapping = decoded.mapping?.mapping;
		if (decoded.operation !== ADD_REPLACE || decoded.serial !== 1 || !mapping) {
			throw new Error('The party topology is not a fresh creation');
		}
		seen.add(mapping.oneofKind ?? '');

		switch (mapping.oneofKind) {
			case 'namespaceDelegation': {
				const d = mapping.namespaceDelegation;
				if (
					d.namespace !== namespace ||
					!d.targetKey ||
					!sameKey(d.targetKey.publicKey, publicKey)
				) {
					throw new Error('The namespace would not be controlled by your key');
				}
				break;
			}
			case 'partyToKeyMapping': {
				const m = mapping.partyToKeyMapping;
				if (
					m.party !== party ||
					m.threshold !== 1 ||
					m.signingKeys.length !== 1 ||
					!sameKey(m.signingKeys[0].publicKey, publicKey) ||
					m.signingKeys[0].keySpec !== EC_CURVE25519
				) {
					throw new Error('The party would be signable by a key that is not yours');
				}
				break;
			}
			case 'partyToParticipant': {
				const m = mapping.partyToParticipant;
				if (
					m.party !== party ||
					m.threshold !== 1 ||
					m.participants.length !== 1 ||
					m.participants[0].permission !== CONFIRMATION
				) {
					throw new Error(
						'The participant would get more than confirmation rights over your party'
					);
				}
				break;
			}
			default:
				throw new Error(`Unexpected topology mapping: ${mapping.oneofKind}`);
		}
	}

	for (const needed of ['namespaceDelegation', 'partyToKeyMapping', 'partyToParticipant']) {
		if (!seen.has(needed)) throw new Error(`The party topology lacks its ${needed}`);
	}
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

function same(a: Plain, b: Plain): boolean {
	if (Array.isArray(a) || Array.isArray(b)) {
		return (
			Array.isArray(a) &&
			Array.isArray(b) &&
			a.length === b.length &&
			a.every((x, i) => same(x, b[i]))
		);
	}
	if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
		const keys = Object.keys(a);
		return keys.length === Object.keys(b).length && keys.every((k) => k in b && same(a[k], b[k]));
	}
	return a === b;
}

export type Expected = {
	party: string;
	choice: string;
	contractId: string;
	args: { [field: string]: Plain };
};

export async function verifyPrepared(
	prepared: { preparedTransaction: string; preparedTransactionHash: string },
	expected: Expected
): Promise<void> {
	const hash = await hashPreparedTransaction(prepared.preparedTransaction, 'base64');
	if (hash !== prepared.preparedTransactionHash) {
		throw new Error('The transaction does not match the hash the server asked to sign');
	}

	const tx = decodePreparedTransaction(prepared.preparedTransaction);

	// The signature authorises exactly the submitter's actAs — so that must be the user, alone.
	const actAs = tx.metadata?.submitterInfo?.actAs ?? [];
	if (actAs.length !== 1 || actAs[0] !== expected.party) {
		throw new Error(`The transaction acts as ${actAs.join(', ') || 'nobody'}, not you`);
	}

	const nodes = tx.transaction?.nodes ?? [];
	const roots = tx.transaction?.roots ?? [];
	const byId = new Map(nodes.map((node) => [node.nodeId, node]));

	// One root, and it is the user exercising the asked-for choice on the asked-for contract.
	// Whatever hangs below it is the choice's own body, authorised by that contract's
	// signatories, not by us.
	const root = roots.length === 1 ? byId.get(roots[0])?.versionedNode : undefined;
	if (root?.oneofKind !== 'v1' || root.v1.nodeType.oneofKind !== 'exercise') {
		throw new Error('Expected a single choice exercise, got something else');
	}

	const exercise = root.v1.nodeType.exercise;
	const template = `${exercise.templateId?.moduleName}:${exercise.templateId?.entityName}`;
	const home = CHOICES[expected.choice];
	if (!home || exercise.choiceId !== expected.choice || template !== home) {
		throw new Error(
			`Expected to sign ${expected.choice} on ${home}, got ${exercise.choiceId} on ${template}`
		);
	}
	if (exercise.packageName !== PACKAGE_NAME || exercise.templateId?.packageId !== packageId) {
		throw new Error('The transaction uses a package this app was not built with');
	}
	if (exercise.contractId !== expected.contractId) {
		throw new Error('The transaction is on a different contract than the one you are looking at');
	}
	if (exercise.actingParties.some((p) => p !== expected.party)) {
		throw new Error(
			`The choice would be exercised by ${exercise.actingParties.join(', ')}, not you`
		);
	}

	if (!same(plain(exercise.chosenValue), expected.args)) {
		throw new Error('The transaction does not say what you asked for');
	}
}
