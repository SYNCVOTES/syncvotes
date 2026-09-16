import { Main } from '@daml.js/model';
import { operatorParty, sdk, streamActiveContracts, type Created } from './participant';

/**
 * The operator's copy of the ledger, in memory: every contract of the app's templates, in the
 * maps the pages read. It is filled from the active contracts at startup and kept current from
 * the update stream, so a read never touches the participant and a DAO of ten thousand costs a
 * map lookup. A page waits on the keys it shows (`nextChange`); a transaction wakes only those.
 */

export type Vote = 'Yes' | 'No';
export type Outcome = 'Passed' | 'Failed';

export type Account = { contractId: string; party: string };
export type Dao = {
	contractId: string;
	id: string;
	admin: string;
	name: string;
	description: string;
	createdAt: string;
};
export type Member = { contractId: string; daoId: string; party: string; since: string };
export type Proposal = {
	contractId: string;
	id: string;
	daoId: string;
	daoName: string;
	admin: string;
	proposer: string;
	title: string;
	description: string;
	createdAt: string;
	closesAt: string;
	openedAt: string | null;
	eligible: number;
	yes: number;
	no: number;
	outcome: Outcome | null;
};
export type Ballot = {
	contractId: string;
	proposalId: string;
	daoId: string;
	voter: string;
	since: string;
	vote: Vote;
	castAt: string;
	counted: boolean;
};

/** Timestamps arrive as ISO text of varying precision; compare them as numbers. */
export const time = (iso: string) => new Date(iso).getTime();

/** Whether a ballot counts for a proposal: a member when it opened, cast before the deadline. */
export const eligible = (p: Proposal, b: { since: string; castAt: string }) =>
	p.openedAt !== null && time(b.since) <= time(p.openedAt) && time(b.castAt) < time(p.closesAt);

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
	all: 'all'
};

const waiting = new Map<string, Set<() => void>>();
const touched = new Set<string>([keys.all]);

/** Resolves the next time a transaction touches `key`. */
export const nextChange = (key: string) =>
	new Promise<void>((resolve) => {
		let set = waiting.get(key);
		if (!set) waiting.set(key, (set = new Set()));
		set.add(resolve);
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
const int = (value: unknown) => Number(value);

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
				admin: text(a.admin),
				name: text(a.name),
				description: text(a.description),
				createdAt: text(a.createdAt)
			};
			track(contractId, [keys.dao(row.id), keys.party(row.admin)], put(daos, row.id, row));
			break;
		}
		case 'Member': {
			const row: Member = {
				contractId,
				daoId: text(a.daoId),
				party: text(a.party),
				since: text(a.since)
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
				daoName: text(a.daoName),
				admin: text(a.admin),
				proposer: text(a.proposer),
				title: text(a.title),
				description: text(a.description),
				createdAt: text(a.createdAt),
				closesAt: text(a.closesAt),
				openedAt: a.openedAt == null ? null : text(a.openedAt),
				eligible: int(a.eligible),
				yes: int(a.yes),
				no: int(a.no),
				outcome: (a.outcome as Outcome | null | undefined) ?? null
			};
			track(
				contractId,
				[keys.proposal(row.id), keys.dao(row.daoId)],
				put(proposals, row.id, row),
				put(inner(proposalsOf, row.daoId), row.id, row)
			);
			break;
		}
		case 'Ballot': {
			const row: Ballot = {
				contractId,
				proposalId: text(a.proposalId),
				daoId: text(a.daoId),
				voter: text(a.voter),
				since: text(a.since),
				vote: a.vote as Vote,
				castAt: text(a.castAt),
				counted: a.counted === true
			};
			track(
				contractId,
				[keys.proposal(row.proposalId), keys.party(row.voter)],
				put(inner(ballots, row.proposalId), row.voter, row)
			);
			break;
		}
	}
}

function archived(contractId: string) {
	removal.get(contractId)?.();
	removal.delete(contractId);
}

// ---- following the ledger ------------------------------------------------------------------

const TEMPLATES = [Main.Account, Main.DAO, Main.Member, Main.Proposal, Main.Ballot].map(
	(t) => t.templateId
);

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
 * hands the pages an up-to-date view. Gives up quietly after a few seconds: the stream lagging
 * is not a failed write.
 */
export async function applied(updateId: string): Promise<void> {
	const deadline = Date.now() + 5000;
	while (!recent.includes(updateId) && Date.now() < deadline) {
		await Promise.race([nextChange(keys.all), new Promise((r) => setTimeout(r, 500))]);
	}
}

async function loadActiveContracts(): Promise<number> {
	const offset = await (await sdk()).ledger.ledgerEnd();
	let count = 0;
	await streamActiveContracts(operatorParty(), TEMPLATES, offset, (c) => {
		created(c);
		count++;
	});
	wake();
	console.log(`Ledger copy built from ${count} active contracts at offset ${offset}`);
	return offset;
}

async function followUpdates(from: number): Promise<number> {
	let offset = from;
	const ledger = await sdk();
	for await (const update of ledger.events.updates({
		partyId: operatorParty(),
		templateIds: TEMPLATES,
		beginOffset: offset,
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
		if (tx.offset) offset = tx.offset;
	}
	return offset;
}

let started = false;

/** Loads the active contracts, then follows the stream for the life of the process. */
export function start(): void {
	if (started) return;
	started = true;
	void (async () => {
		let offset: number | undefined;
		for (;;) {
			try {
				offset ??= await loadActiveContracts();
				offset = await followUpdates(offset);
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
