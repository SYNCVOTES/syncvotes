import { Templates } from '$lib/templates';
import { providerParty, sdk, streamActiveContracts, type Created } from './participant';
import type { Rule, Settings } from '$lib/rules';

/**
 * The provider's copy of the ledger, in memory: every contract of the app's templates (the
 * provider signs each one, so it sees them all), in the maps the pages read. It is filled from
 * the active contracts at startup and kept current from the update stream, so a read never
 * touches the participant and a DAO of ten thousand costs a map lookup. A page waits on the
 * keys it shows (`nextChange`); a transaction wakes only those.
 */

/**
 * Yes, no, abstain — or `Pick:<n>`, the option picked on a choice among options, or
 * `PickMany:<n>,<m>` where the choice takes several.
 */
export type Vote = 'Yes' | 'No' | 'Abstain' | `Pick:${number}` | `PickMany:${string}`;
/** Passed, failed — or `Chosen:<n>` / `ChosenMany:<n>,<m>`, the options a choice decided on. */
export type Outcome = 'Passed' | 'Failed' | `Chosen:${number}` | `ChosenMany:${string}`;
/** The option a vote picked, or a choice decided on. */
export const pickOf = (v: string | null): number | null =>
	v?.startsWith('Pick:')
		? Number(v.slice(5))
		: v?.startsWith('Chosen:')
			? Number(v.slice(7))
			: null;
/** The options a vote picked or a choice decided on: one, several, or none at all. */
export const picksOf = (v: string | null): number[] => {
	const one = pickOf(v);
	if (one !== null) return [one];
	const many = v?.startsWith('PickMany:')
		? v.slice(9)
		: v?.startsWith('ChosenMany:')
			? v.slice(11)
			: null;
	return many ? many.split(',').filter(Boolean).map(Number) : [];
};
/** Whether an outcome is a decision in favour: passed, or an option chosen. */
export const passed = (o: Outcome | null): boolean =>
	o === 'Passed' || !!o?.startsWith('Chosen:') || !!o?.startsWith('ChosenMany:');
export type Effect =
	| { kind: 'signal' }
	| { kind: 'choose'; options: string[]; several: boolean }
	| { kind: 'shares'; changes: { party: string; share: number }[] }
	| { kind: 'info'; name: string; description: string; image: string | null }
	| { kind: 'dissolve' }
	| { kind: 'settings'; routine: Settings; sensitive: Settings }
	| { kind: 'visibility'; public: boolean };

export type Account = { contractId: string; party: string };
export type Dao = {
	contractId: string;
	id: string;
	/** Who created it; no powers come with that. */
	creator: string;
	name: string;
	description: string;
	image: string | null;
	/** One member, one unit of the vote. */
	equal: boolean;
	/** The founding default a proposer's rule for a decision or a choice starts from. */
	routine: Settings;
	/** What anything that changes the DAO runs under: members, info, these rules, dissolution. */
	sensitive: Settings;
	createdAt: string;
	members: number;
	/** The whole vote, in units. */
	units: number;
	/** Each member pays the traffic of what they sign; otherwise the DAO's balance does. */
	actorPays: boolean;
	/** Readable by anyone signed in, through the app; only members act. */
	public: boolean;
	/** Since when a passed dissolution waits; nothing new is proposed meanwhile. */
	dissolving: string | null;
};
export type Member = {
	contractId: string;
	daoId: string;
	party: string;
	since: string;
	/** Units of the vote. */
	share: number;
	shareSince: string;
};
export type Proposal = {
	contractId: string;
	id: string;
	daoId: string;
	creator: string;
	proposer: string;
	title: string;
	description: string;
	effect: Effect;
	rule: Rule;
	/** The whole vote when it was made, in units. */
	eligible: number;
	createdAt: string;
	closesAt: string;
	yes: number;
	no: number;
	abstain: number;
	/** Units per option on a choice; empty otherwise. */
	tallies: number[];
	outcome: Outcome | null;
	/** Entries of the effect carried out so far. */
	executed: number;
	executedAt: string | null;
	/** Who voted how is not shown by the app. */
	secret: boolean;
	/** Units of the ballots that picked options, on a choice that takes several picks. */
	picked: number | null;
};
export type Ballot = {
	contractId: string;
	proposalId: string;
	daoId: string;
	voter: string;
	since: string;
	vote: Vote;
	weight: number;
	shareSince: string;
	closesAt: string;
	changeable: boolean;
	castAt: string;
	counted: boolean;
	/** A `BallotV2` (voter and provider only), counted through `Proposal_Tally`'s `cast`. */
	v2: boolean;
};
export type Comment = {
	contractId: string;
	id: string;
	daoId: string;
	proposalId: string;
	author: string;
	body: string;
	createdAt: string;
};
export type Profile = {
	contractId: string;
	party: string;
	name: string;
	avatar: string | null;
	bio: string;
	updatedAt: string;
};
export type Meter = {
	contractId: string;
	daoId: string;
	credited: number;
	charged: number;
	updatedAt: string;
};
/** A party's own account with the provider, by its key's fingerprint. */
export type Purse = {
	contractId: string;
	fingerprint: string;
	party: string | null;
	credited: number;
	charged: number;
	updatedAt: string;
};

/** Timestamps arrive as ISO text of varying precision; compare them as numbers. */
export const time = (iso: string) => new Date(iso).getTime();

/**
 * Whether a ballot counts for a proposal: a member, with that share, when it was made, cast
 * before the deadline.
 */
export const eligible = (p: Proposal, b: { since: string; shareSince: string; castAt: string }) =>
	time(b.since) <= time(p.createdAt) &&
	time(b.shareSince) <= time(p.createdAt) &&
	time(b.castAt) < time(p.closesAt);

/** by party */
export const accounts = new Map<string, Account>();
/** by DAO id — an edit replaces the contract, the id stays */
export const daos = new Map<string, Dao>();
/** by DAO id, then party */
export const members = new Map<string, Map<string, Member>>();
/** by party, then DAO id */
export const memberships = new Map<string, Map<string, Member>>();
/** by proposal id */
export const proposals = new Map<string, Proposal>();
/** by DAO id, then proposal id */
export const proposalsOf = new Map<string, Map<string, Proposal>>();
/** by proposal id, then voter */
export const ballots = new Map<string, Map<string, Ballot>>();
/** by proposal id, then comment id */
export const comments = new Map<string, Map<string, Comment>>();
/** by party */
export const profiles = new Map<string, Profile>();
/** by DAO id */
export const meters = new Map<string, Meter>();
export const purses = new Map<string, Purse>();

const inner = <V>(map: Map<string, Map<string, V>>, key: string): Map<string, V> => {
	let found = map.get(key);
	if (!found) map.set(key, (found = new Map()));
	return found;
};

// ---- who is waiting for what -------------------------------------------------------------

export const keys = {
	dao: (id: string) => `dao:${id}`,
	proposal: (id: string) => `proposal:${id}`,
	party: (party: string) => `party:${party}`,
	purse: (fingerprint: string) => `purse:${fingerprint}`,
	all: 'all'
};

const waiting = new Map<string, Set<() => void>>();
const touched = new Set<string>([keys.all]);

/**
 * Resolves the next time a transaction touches any of these keys; its place under the others
 * is given up then.
 */
export const nextChange = (...keys: string[]) =>
	new Promise<void>((resolve) => {
		const done = () => {
			for (const key of keys) waiting.get(key)?.delete(done);
			resolve();
		};
		for (const key of keys) {
			let set = waiting.get(key);
			if (!set) waiting.set(key, (set = new Set()));
			set.add(done);
		}
	});

const wake = () => {
	for (const key of touched) {
		const set = waiting.get(key);
		waiting.delete(key);
		set?.forEach((resolve) => resolve());
	}
	touched.clear();
	touched.add(keys.all);
};

/** Wakes whoever waits on `key` for a change that did not come from the ledger. */
export function notify(...changed: string[]): void {
	changed.forEach((k) => touched.add(k));
	wake();
}

// ---- applying the ledger's events ---------------------------------------------------------

/** How to take each contract out of the maps again, by contract id. */
const removal = new Map<string, () => void>();

/** Puts `row` under `key` and returns the removal, which is a no-op if `key` was replaced since. */
const put = <V>(map: Map<string, V>, key: string, row: V) => {
	map.set(key, row);
	return () => {
		if (map.get(key) === row) map.delete(key);
	};
};

function track(contractId: string, touches: string[], ...removals: (() => void)[]) {
	touches.forEach((k) => touched.add(k));
	removal.set(contractId, () => {
		removals.forEach((remove) => remove());
		touches.forEach((k) => touched.add(k));
	});
}

const templateName = (templateId: string) => templateId.split(':').pop();
const text = (value: unknown) => String(value);
const num = (value: unknown) => Number(value);

type Tagged = { tag: string; value: Record<string, unknown> };

const rule = (v: unknown): Rule => {
	const r = v as {
		basis: string;
		threshold: Tagged;
		quorum: unknown;
		early: boolean;
		changeable: boolean;
		secret?: boolean | null;
	};
	return {
		basis: r.basis === 'OfCast' ? 'cast' : 'all',
		threshold:
			r.threshold.tag === 'Percent'
				? { kind: 'percent', percent: num(r.threshold.value) }
				: r.threshold.tag === 'Fraction'
					? {
							kind: 'fraction',
							num: num((r.threshold.value as { num: unknown }).num),
							den: num((r.threshold.value as { den: unknown }).den)
						}
					: { kind: 'majority' },
		quorum: num(r.quorum),
		early: r.early === true,
		changeable: r.changeable === true,
		secret: r.secret === true
	};
};

const optional = (value: unknown) => (value == null ? null : text(value));
/**
 * A variant with at most one payload-carrying constructor, as the JSON API writes it: a bare
 * string while every constructor is empty, `{tag, value}` once one is not. Read as
 * `Tag` or `Tag:<int>`.
 */
const tagged = (value: unknown): string => {
	if (typeof value === 'string') return value;
	const v = value as { tag?: unknown; value?: unknown };
	const tag = text(v?.tag);
	return Array.isArray(v?.value)
		? `${tag}:${v.value.map(num).join(',')}`
		: typeof v?.value === 'object' && v.value !== null
			? tag
			: v?.value == null
				? tag
				: `${tag}:${num(v.value)}`;
};

const settings = (v: unknown): Settings => {
	const x = v as { rule: unknown; votingDays: unknown };
	return { rule: rule(x.rule), votingDays: num(x.votingDays) };
};

const effect = (v: unknown): Effect => {
	const t = v as Tagged;
	switch (t.tag) {
		case 'SetShares':
			return {
				kind: 'shares',
				changes: (t.value.changes as { _1: string; _2: unknown }[]).map((e) => ({
					party: text(e._1),
					share: num(e._2)
				}))
			};
		case 'SetInfo':
			return {
				kind: 'info',
				name: text(t.value.daoName),
				description: text(t.value.description),
				image: optional(t.value.image)
			};
		case 'Choose':
			return {
				kind: 'choose',
				options: ((t.value as { options: unknown[] }).options ?? []).map(text),
				several: (t.value as { several?: unknown }).several === true
			};
		case 'Dissolve':
			return { kind: 'dissolve' };
		case 'SetPublic':
			return { kind: 'visibility', public: (t.value as { public?: unknown }).public === true };
		case 'SetRules':
			return {
				kind: 'settings',
				routine: settings(t.value.rules),
				sensitive: settings(t.value.rules)
			};
		default:
			return { kind: 'signal' };
	}
};

function created({ contractId, templateId, createArgument: a }: Created) {
	switch (templateName(templateId)) {
		case 'Account': {
			const row: Account = { contractId, party: text(a.user) };
			track(contractId, [keys.all], put(accounts, row.party, row));
			break;
		}
		case 'DAO': {
			const row: Dao = {
				contractId,
				id: text(a.id),
				creator: text(a.creator),
				name: text(a.name),
				description: text(a.description),
				image: optional(a.image),
				equal: a.equal === true,
				routine: settings(a.decisions),
				sensitive: settings(a.rules),
				createdAt: text(a.createdAt),
				members: num(a.members),
				units: num(a.units),
				actorPays: a.actorPays === true,
				public: a.public === true,
				dissolving: optional(a.dissolving)
			};
			track(contractId, [keys.dao(row.id), keys.party(row.creator)], put(daos, row.id, row));
			break;
		}
		case 'Member': {
			const row: Member = {
				contractId,
				daoId: text(a.daoId),
				party: text(a.party),
				since: text(a.since),
				share: num(a.share),
				shareSince: text(a.shareSince)
			};
			track(
				contractId,
				[keys.dao(row.daoId), keys.party(row.party)],
				put(inner(members, row.daoId), row.party, row),
				put(inner(memberships, row.party), row.daoId, row)
			);
			break;
		}
		case 'Proposal': {
			const row: Proposal = {
				contractId,
				id: text(a.id),
				daoId: text(a.daoId),
				creator: text(a.creator),
				proposer: text(a.proposer),
				title: text(a.title),
				description: text(a.description),
				effect: effect(a.action),
				rule: rule(a.rule),
				eligible: num(a.eligible),
				createdAt: text(a.createdAt),
				closesAt: text(a.closesAt),
				yes: num(a.yes),
				no: num(a.no),
				abstain: num(a.abstain),
				tallies: ((a.tallies as unknown[] | undefined) ?? []).map(num),
				outcome: a.outcome == null ? null : (tagged(a.outcome) as Outcome),
				executed: num(a.executed),
				executedAt: optional(a.executedAt),
				secret: (a.rule as { secret?: unknown } | undefined)?.secret === true,
				picked: num(a.picked)
			};
			track(
				contractId,
				[keys.proposal(row.id), keys.dao(row.daoId)],
				put(proposals, row.id, row),
				put(inner(proposalsOf, row.daoId), row.id, row)
			);
			break;
		}
		case 'Ballot':
		case 'BallotV2': {
			const row: Ballot = {
				contractId,
				proposalId: text(a.proposalId),
				daoId: text(a.daoId),
				voter: text(a.voter),
				since: text(a.since),
				vote: tagged(a.vote) as Vote,
				weight: num(a.weight),
				shareSince: text(a.shareSince),
				closesAt: text(a.closesAt),
				changeable: a.changeable === true,
				castAt: text(a.castAt),
				counted: a.counted === true,
				v2: templateName(templateId) === 'BallotV2'
			};
			track(
				contractId,
				[keys.proposal(row.proposalId), keys.party(row.voter)],
				put(inner(ballots, row.proposalId), row.voter, row)
			);
			break;
		}
		case 'Comment': {
			const row: Comment = {
				contractId,
				id: text(a.id),
				daoId: text(a.daoId),
				proposalId: text(a.proposalId),
				author: text(a.author),
				body: text(a.body),
				createdAt: text(a.createdAt)
			};
			track(
				contractId,
				[keys.proposal(row.proposalId)],
				put(inner(comments, row.proposalId), row.id, row)
			);
			break;
		}
		case 'Profile': {
			const row: Profile = {
				contractId,
				party: text(a.user),
				name: text(a.name),
				avatar: optional(a.avatar),
				bio: text(a.bio),
				updatedAt: text(a.updatedAt)
			};
			track(contractId, [keys.party(row.party), keys.all], put(profiles, row.party, row));
			break;
		}
		case 'Meter': {
			const row: Meter = {
				contractId,
				daoId: text(a.daoId),
				credited: num(a.credited),
				charged: num(a.charged),
				updatedAt: text(a.updatedAt)
			};
			track(contractId, [keys.dao(row.daoId)], put(meters, row.daoId, row));
			break;
		}
		case 'Purse': {
			const row: Purse = {
				contractId,
				fingerprint: text(a.fingerprint),
				party: optional(a.party),
				credited: num(a.credited),
				charged: num(a.charged),
				updatedAt: text(a.updatedAt)
			};
			track(contractId, [keys.purse(row.fingerprint)], put(purses, row.fingerprint, row));
			break;
		}
	}
}

function archived(contractId: string) {
	removal.get(contractId)?.();
	removal.delete(contractId);
}

// ---- following the ledger ------------------------------------------------------------------

const TEMPLATES = [
	Templates.Account,
	Templates.DAO,
	Templates.Member,
	Templates.Proposal,
	Templates.Ballot,
	Templates.BallotV2,
	Templates.Comment,
	Templates.Profile,
	Templates.Meter,
	Templates.Purse
].map((t) => t.templateId);

type Event =
	{ CreatedEvent: Created } | { ArchivedEvent: { contractId: string } } | Record<string, never>;
type Update = {
	update?: { Transaction?: { value?: { updateId: string; offset?: number; events?: Event[] } } };
};

/** Transaction ids applied so far, newest last; enough for `applied` to answer recent ones. */
const recent: string[] = [];
const RECENT = 1000;

/**
 * Resolves once the transaction `updateId` is in the maps — how a write that just committed
 * hands the pages an up-to-date view. Gives up quietly after fifteen seconds: the stream lagging
 * is not a failed write.
 */
export async function applied(updateId: string): Promise<boolean> {
	const deadline = Date.now() + 15_000;
	while (!recent.includes(updateId) && Date.now() < deadline) {
		await Promise.race([nextChange(keys.all), new Promise((r) => setTimeout(r, 500))]);
	}
	return recent.includes(updateId);
}

async function loadActiveContracts(): Promise<number> {
	const offset = await (await sdk()).ledger.ledgerEnd();
	let count = 0;
	await streamActiveContracts(providerParty(), TEMPLATES, offset, (c) => {
		created(c);
		count++;
	});
	wake();
	console.log(`Ledger copy built from ${count} active contracts at offset ${offset}`);
	return offset;
}

/** The offset of the last transaction applied: a broken stream resumes from here. */
let appliedAt: number | undefined;

async function followUpdates(from: number): Promise<void> {
	appliedAt = from;
	const ledger = await sdk();
	for await (const update of ledger.events.updates({
		partyId: providerParty(),
		templateIds: TEMPLATES,
		beginOffset: from,
		verbose: false
	})) {
		const tx = (update as Update).update?.Transaction?.value;
		if (!tx) continue;
		for (const e of tx.events ?? []) {
			if ('CreatedEvent' in e) created(e.CreatedEvent);
			else if ('ArchivedEvent' in e) archived(e.ArchivedEvent.contractId);
		}
		if (recent.push(tx.updateId) > RECENT) recent.shift();
		wake();
		if (tx.offset) appliedAt = tx.offset;
	}
}

let started = false;
let loaded: () => void = () => {};
const firstLoad = new Promise<void>((resolve) => (loaded = resolve));

/** Resolves once the copy holds the active contracts: before that, a read would say "no such DAO". */
export const ready = () => firstLoad;

/** Loads the active contracts, then follows the stream for the life of the process. */
export function start(): void {
	if (started) return;
	started = true;
	void (async () => {
		for (;;) {
			try {
				appliedAt ??= await loadActiveContracts();
				loaded();
				await followUpdates(appliedAt);
				console.warn('Ledger update stream ended; reconnecting');
			} catch (e) {
				console.warn(
					'Ledger update stream failed; reconnecting',
					e instanceof Error ? e.message : e
				);
			}
			await new Promise((r) => setTimeout(r, 2000));
		}
	})();
}
