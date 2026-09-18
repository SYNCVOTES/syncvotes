import { error } from '@sveltejs/kit';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { Main } from '@daml.js/model';
import * as ledger from './ledger';
import * as splice from './splice';
import * as billing from './billing';
import {
	allocateMultiKeyParty,
	execute,
	operatorParty,
	partyKnown,
	prepare,
	sdk,
	type DisclosedContract,
	type Prepared,
	type Signature
} from './participant';

/**
 * A DAO's treasury is a party owned by its admins' keys, `threshold` of which sign a payout.
 * Canton builds nothing of the kind on request, so the topology is written here by hand from
 * the protos — one root certificate per admin, a decentralized namespace they own together,
 * and the party hosted here with their keys as its signing set — and every admin's browser
 * checks it against the same expectation before signing. Rotation is not a thing the network
 * offers; new admins mean a new treasury and a payout from the old.
 *
 * A prepared transaction lives about two minutes on the network, so signatures for one are
 * collected in a session: whoever comes first opens it, the others sign the same preparation,
 * and it executes the moment the threshold is met.
 */

// ---- Protobuf, the four bits of it this needs -------------------------------------------

const varint = (n: number | bigint) => {
	const out: number[] = [];
	let v = BigInt(n);
	do {
		let b = Number(v & 127n);
		v >>= 7n;
		if (v) b |= 128;
		out.push(b);
	} while (v);
	return Buffer.from(out);
};
const field = (num: number, wire: number, payload: Buffer) =>
	Buffer.concat([varint((num << 3) | wire), payload]);
const uint = (num: number, n: number) => field(num, 0, varint(n));
const bytes = (num: number, b: Buffer) => field(num, 2, Buffer.concat([varint(b.length), b]));
const str = (num: number, s: string) => bytes(num, Buffer.from(s, 'utf8'));

type Field = { num: number; value: Buffer | bigint };
function decode(buf: Buffer): Field[] {
	const out: Field[] = [];
	let i = 0;
	const next = () => {
		let r = 0n;
		let s = 0n;
		for (;;) {
			const b = buf[i++];
			r |= BigInt(b & 127) << s;
			if (!(b & 128)) return r;
			s += 7n;
		}
	};
	while (i < buf.length) {
		const tag = Number(next());
		const num = tag >> 3;
		const wire = tag & 7;
		if (wire === 0) out.push({ num, value: next() });
		else if (wire === 2) {
			const len = Number(next());
			out.push({ num, value: buf.subarray(i, i + len) });
			i += len;
		} else throw new Error(`Unexpected wire type ${wire}`);
	}
	return out;
}
const one = (fs: Field[], num: number) => {
	const f = fs.find((x) => x.num === num);
	if (!f || !(f.value instanceof Buffer)) throw new Error(`Field ${num} missing`);
	return f.value;
};

// Wire values: TOPOLOGY_CHANGE_OP_ADD_REPLACE, the versioned wrapper's protocol version,
// CRYPTO_KEY_FORMAT_DER_X509_SUBJECT_PUBLIC_KEY_INFO, SIGNING_KEY_SPEC_EC_CURVE25519,
// HashPurpose.DecentralizedNamespace.
const ADD_REPLACE = 1;
const PROTO_VERSION = 30;
const DER_SPKI = 4;
const EC_CURVE25519 = 1;
const DECENTRALIZED_NAMESPACE = 37;
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * What the participant writes for a party of its own making: the hosting participant and the
 * key usages, copied verbatim so a treasury's mapping reads exactly like a member's.
 */
const shape = (() => {
	let cached: Promise<{ hosting: Buffer; usage: Buffer }> | undefined;
	return () =>
		(cached ??= (async () => {
			const { publicKey } = generateKeyPairSync('ed25519');
			const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
			const raw = spki.subarray(spki.length - 32).toString('base64');
			const probe = await (
				await sdk()
			).party.external
				.create(raw, { partyHint: 'shape-probe' })
				.topology();
			const wrapper = decode(Buffer.from(probe.topologyTransactions[0], 'base64'));
			const mapping = decode(one(decode(one(wrapper, 1)), 3));
			const hosting = decode(one(mapping, 9));
			const key = decode(one(decode(one(hosting, 6)), 1));
			return { hosting: one(hosting, 3), usage: one(key, 5) };
		})());
})();

const wrap = (mapping: Buffer) =>
	Buffer.concat([
		bytes(1, Buffer.concat([uint(1, ADD_REPLACE), uint(2, 1), bytes(3, mapping)])),
		uint(2, PROTO_VERSION)
	]).toString('base64');

const signingKey = (rawKey: Buffer, usage: Buffer) =>
	Buffer.concat([
		uint(2, DER_SPKI),
		bytes(3, Buffer.concat([SPKI_PREFIX, rawKey])),
		bytes(5, usage),
		uint(6, EC_CURVE25519)
	]);

/** DecentralizedNamespaceDefinition.computeNamespace: the sorted owners, length-prefixed. */
export function decentralizedNamespace(owners: string[]): string {
	const h = createHash('sha256');
	h.update(Buffer.from([0, 0, 0, DECENTRALIZED_NAMESPACE]));
	for (const o of [...owners].sort()) {
		const b = Buffer.from(o, 'utf8');
		const len = Buffer.alloc(4);
		len.writeUInt32BE(b.length);
		h.update(len);
		h.update(b);
	}
	return '1220' + h.digest('hex');
}

export type Plan = {
	party: string;
	owners: { party: string; fingerprint: string; publicKey: string }[];
	threshold: number;
	transactions: string[];
	multiHash: string;
};

/** The treasury a DAO's admins would own, as topology transactions for them to sign. */
export async function plan(daoId: string, threshold: number): Promise<Plan> {
	const dao = ledger.daos.get(daoId);
	if (!dao) throw error(404, 'No such DAO');
	if (threshold < 1 || threshold > dao.admins.length) throw error(400, 'Threshold out of range');
	const owners = dao.admins.map((party) => {
		const account = ledger.accounts.get(party);
		if (!account) throw error(409, `${party} is not registered`);
		return { party, fingerprint: party.split('::')[1], publicKey: account.publicKey };
	});
	const { hosting, usage } = await shape();
	const namespace = decentralizedNamespace(owners.map((o) => o.fingerprint));
	const party = `treasury-${daoId.slice(0, 8)}::${namespace}`;
	const keyOf = (o: (typeof owners)[number]) =>
		signingKey(Buffer.from(o.publicKey, 'base64'), usage);
	const roots = owners.map((o) =>
		wrap(
			bytes(
				1,
				Buffer.concat([str(1, o.fingerprint), bytes(2, keyOf(o)), bytes(4, Buffer.alloc(0))])
			)
		)
	);
	const definition = wrap(
		bytes(
			3,
			Buffer.concat([
				str(1, namespace),
				uint(2, owners.length),
				...owners
					.map((o) => o.fingerprint)
					.sort()
					.map((fp) => str(3, fp))
			])
		)
	);
	const mapping = wrap(
		bytes(
			9,
			Buffer.concat([
				str(1, party),
				uint(2, 1),
				bytes(3, hosting),
				bytes(6, Buffer.concat([...owners.map((o) => bytes(1, keyOf(o))), uint(2, threshold)]))
			])
		)
	);
	const transactions = [...roots, definition, mapping];
	const multiHash = await (await sdk()).utils.hash.topologyTransaction(transactions);
	return { party, owners, threshold, transactions, multiHash };
}

// ---- The setup ceremony: every admin signs the identity, once ------------------------------

type Setup = {
	plan: Plan;
	signatures: Map<string, string>;
	allocated: boolean;
	proposal: string | null;
	problem: string | null;
};
const setups = new Map<string, Setup>();

export type SetupView = {
	party: string;
	threshold: number;
	signed: string[];
	pending: string[];
	allocated: boolean;
	/** The pre-approval offer waiting to be accepted by `threshold` admins, if any. */
	proposal: string | null;
	approved: boolean;
	problem: string | null;
};

/** Where a DAO's treasury setup stands; nothing if none is under way. */
export async function setup(daoId: string): Promise<SetupView | null> {
	const s = setups.get(daoId);
	if (!s) return null;
	const owners = s.plan.owners.map((o) => o.party);
	const signed = owners.filter((p) => s.signatures.has(p));
	let approved = false;
	if (s.allocated) {
		const state = await splice.setupState(s.plan.party);
		approved = state.approved;
		s.proposal = state.proposal?.contractId ?? null;
	}
	return {
		party: s.plan.party,
		threshold: s.plan.threshold,
		signed,
		pending: owners.filter((p) => !s.signatures.has(p)),
		allocated: s.allocated,
		proposal: s.proposal,
		approved,
		problem: s.problem
	};
}

/** Starts (or restarts) the ceremony for a DAO with the admins of the moment. */
export async function begin(daoId: string, threshold: number): Promise<Plan> {
	const p = await plan(daoId, threshold);
	setups.set(daoId, {
		plan: p,
		signatures: new Map(),
		allocated: false,
		proposal: null,
		problem: null
	});
	ledger.notify(ledger.keys.dao(daoId));
	return p;
}

export const current = (daoId: string): Plan | null => setups.get(daoId)?.plan ?? null;

/**
 * An admin's signature over the multi-hash. The last one in allocates the party and asks the
 * validator to offer it a pre-approval.
 */
export async function signSetup(daoId: string, party: string, signature: string): Promise<void> {
	const s = setups.get(daoId);
	if (!s) throw error(404, 'No treasury setup is under way');
	const owner = s.plan.owners.find((o) => o.party === party);
	if (!owner) throw error(403, 'Only an admin of this DAO signs its treasury');
	s.signatures.set(party, signature);
	ledger.notify(ledger.keys.dao(daoId));
	if (s.signatures.size < s.plan.owners.length || s.allocated) return;
	try {
		await allocateMultiKeyParty(
			s.plan.transactions,
			s.plan.owners.map((o) => ({
				fingerprint: o.fingerprint,
				signature: s.signatures.get(o.party)!
			}))
		);
		for (let i = 0; i < 60 && !(await partyKnown(s.plan.party)); i++) {
			await new Promise((r) => setTimeout(r, 1000));
		}
		s.allocated = true;
		s.proposal = await splice.proposeSetup(s.plan.party);
	} catch (e) {
		s.problem = e instanceof Error ? e.message.slice(0, 300) : String(e);
		s.signatures.clear();
	}
	ledger.notify(ledger.keys.dao(daoId));
}

export function finish(daoId: string): void {
	setups.delete(daoId);
	ledger.notify(ledger.keys.dao(daoId));
}

// ---- Signing sessions: threshold signatures within the network's two minutes -------------

export type Intent =
	| { kind: 'approve'; proposal: string }
	| { kind: 'payout'; due: string; to: string; amount: number }
	| { kind: 'move'; to: string; amount: number };

type Session = {
	id: string;
	daoId: string;
	party: string;
	threshold: number;
	intent: Intent;
	prepared: Prepared;
	signatures: Map<string, string>;
	openedAt: number;
	done: boolean;
	problem: string | null;
};
const sessions = new Map<string, Session>();
const SESSION_TTL = 100_000;

export type SessionView = {
	id: string;
	intent: Intent;
	signed: string[];
	threshold: number;
	expiresAt: string;
	done: boolean;
	problem: string | null;
	prepared: Omit<Prepared, 'cost'>;
};

const view = (s: Session): SessionView => ({
	id: s.id,
	intent: s.intent,
	signed: [...s.signatures.keys()],
	threshold: s.threshold,
	expiresAt: new Date(s.openedAt + SESSION_TTL).toISOString(),
	done: s.done,
	problem: s.problem,
	prepared: {
		preparedTransaction: s.prepared.preparedTransaction,
		preparedTransactionHash: s.prepared.preparedTransactionHash,
		hashingSchemeVersion: s.prepared.hashingSchemeVersion
	}
});

/** The live sessions of a DAO's treasury, newest first. */
export function sessionsOf(daoId: string): SessionView[] {
	const now = Date.now();
	for (const [id, s] of sessions) if (now - s.openedAt > SESSION_TTL + 60_000) sessions.delete(id);
	return [...sessions.values()]
		.filter((s) => s.daoId === daoId && (s.done || now - s.openedAt < SESSION_TTL))
		.sort((a, b) => b.openedAt - a.openedAt)
		.map(view);
}

const treasuryOf = (daoId: string): ledger.Treasury => {
	const dao = ledger.daos.get(daoId);
	if (!dao) throw error(404, 'No such DAO');
	const setup = setups.get(daoId);
	if (dao.treasury) return dao.treasury;
	if (setup?.allocated) {
		return {
			party: setup.plan.party,
			signers: setup.plan.owners.map((o) => o.party),
			threshold: setup.plan.threshold
		};
	}
	throw error(409, 'This DAO has no treasury');
};

/** The commands an intent means, prepared for the treasury party. */
async function build(daoId: string, t: ledger.Treasury, intent: Intent) {
	let commands: unknown[] = [];
	let disclosed: DisclosedContract[] = [];
	switch (intent.kind) {
		case 'approve': {
			const { proposal } = await splice.setupState(t.party);
			if (!proposal) throw error(409, 'The validator has not offered a pre-approval yet');
			intent.proposal = proposal.contractId;
			commands = [
				{
					ExerciseCommand: {
						templateId: splice.SETUP_PROPOSAL,
						contractId: proposal.contractId,
						choice: 'ExternalPartySetupProposal_Accept',
						choiceArgument: {}
					}
				}
			];
			break;
		}
		case 'payout': {
			const due = [...(ledger.payouts.get(daoId)?.values() ?? [])].find(
				(d) => d.contractId === intent.due
			);
			if (!due) throw error(404, 'No such payout');
			// The transfer the token standard would make, handed to the payout to make itself.
			const [transfer, d] = await splice.transferCommand(
				t.party,
				due.to,
				due.amount.toFixed(10),
				`syncvotes payout ${due.proposalId}`
			);
			commands = [
				{
					ExerciseCommand: {
						templateId: Main.PayoutDue.templateId,
						contractId: due.contractId,
						choice: 'PayoutDue_Settle',
						choiceArgument: {
							factory: transfer.ExerciseCommand.contractId,
							transfer: transfer.ExerciseCommand.choiceArgument
						}
					}
				}
			];
			disclosed = d;
			intent.to = due.to;
			intent.amount = due.amount;
			break;
		}
		case 'move': {
			const [transfer, d] = await splice.transferCommand(
				t.party,
				intent.to,
				intent.amount.toFixed(10),
				'syncvotes treasury moved'
			);
			commands = [transfer];
			disclosed = d;
			break;
		}
	}
	return prepare(t.party, commands, {
		dao: daoId,
		disclosedContracts: disclosed,
		signatures: t.threshold
	});
}

/** Opens a session: prepares the transaction the intent means and waits for signatures. */
export async function open(daoId: string, intent: Intent): Promise<SessionView> {
	const t = treasuryOf(daoId);
	const prepared = await build(daoId, t, intent);
	const s: Session = {
		id: crypto.randomUUID(),
		daoId,
		party: t.party,
		threshold: t.threshold,
		intent,
		prepared,
		signatures: new Map(),
		openedAt: Date.now(),
		done: false,
		problem: null
	};
	sessions.set(s.id, s);
	ledger.notify(ledger.keys.dao(daoId));
	return view(s);
}

/** A signer's signature over the session's hash; executes once `threshold` are in. */
export async function sign(id: string, party: string, signature: string): Promise<SessionView> {
	const s = sessions.get(id);
	if (!s) throw error(404, 'No such signing session');
	const t = treasuryOf(s.daoId);
	if (!t.signers.includes(party)) throw error(403, 'Only a treasury signer can sign this');
	if (s.done) throw error(409, 'Already executed');
	if (Date.now() - s.openedAt > SESSION_TTL)
		throw error(409, 'This session has expired; open a new one');
	s.signatures.set(party, signature);
	ledger.notify(ledger.keys.dao(s.daoId));
	if (s.signatures.size >= s.threshold) {
		try {
			const updateId = await execute(
				s.party,
				s.prepared,
				[...s.signatures].map(([p, sig]) => ({ fingerprint: p.split('::')[1], signature: sig }))
			);
			s.done = true;
			await ledger.applied(updateId);
			void billing.settle(s.daoId, updateId, s.party);
		} catch (e) {
			s.problem =
				e instanceof Error
					? e.message
					: ((e as { body?: { message?: string } }).body?.message ?? String(e));
			sessions.delete(id);
		}
		ledger.notify(ledger.keys.dao(s.daoId));
	}
	return view(s);
}

export const operator = operatorParty;
