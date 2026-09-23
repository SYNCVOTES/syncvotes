import { Main } from '@daml.js/model';
import { submitAsProvider } from './participant';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { STATE_DIR } from '$app/env/private';
import * as ledger from './ledger';
import * as billing from './billing';
import * as treasury from './treasury';

/**
 * The provider's jobs: count, and carry out. Every proposal with uncounted ballots gets a
 * `Proposal_Tally` of a batch of them — once the deadline has passed, where votes may change
 * until then; a few minutes after the deadline (ballots signed at the last moment still
 * arrive) the batch that empties the queue is final and decides the outcome. A passed
 * proposal with something to do gets a `DAO_Execute` per batch of its entries; a payout moves
 * the coin first and records it after. One count at a time per proposal, since each replaces
 * the contract. What fails is retried later, less and less often, and after enough failures
 * the proposal says why it is stuck. The ledger checks every ballot and every effect it is
 * handed, so this can only delay a result, never change it.
 */

const BATCH = 200;
/** How long after the deadline a ballot may still land: the signing window, and some. */
export const GRACE = 3 * 60_000;
const counting = new Set<string>();
const again = new Set<string>();
const executing = new Set<string>();
/** Ballots the ledger refused: handed in once alone, never again. */
const refused = new Set<string>();
/** Failures per proposal, and when it may be tried again. */
const failures = new Map<string, { count: number; next: number; reason: string }>();
/** Why a proposal could not be carried out, after enough tries; for the page. */
export const stuck = new Map<string, string>();
const STUCK_AFTER = 5;

/**
 * Payouts made, by proposal id: the transfer's transaction. Kept on disk as well, so a
 * restart between the transfer and its record on the ledger cannot pay twice. A state
 * directory that cannot be written is fatal: without the record every restart would pay again.
 */
export const paid = new Map<string, string>();
const PAID_FILE = `${STATE_DIR ?? '/data'}/paid.json`;
try {
	for (const [k, v] of Object.entries(JSON.parse(readFileSync(PAID_FILE, 'utf8')))) {
		paid.set(k, String(v));
	}
} catch {
	// Nothing paid yet: the map starts empty.
}
function markPaid(proposalId: string, updateId: string) {
	paid.set(proposalId, updateId);
	mkdirSync(PAID_FILE.slice(0, PAID_FILE.lastIndexOf('/')), { recursive: true });
	writeFileSync(PAID_FILE, JSON.stringify(Object.fromEntries(paid)));
}

/** Whether a payout that went out still waits for its receiver to accept it. */
export function awaiting(p: ledger.Proposal): boolean {
	if (p.effect.kind !== 'payout') return false;
	const { to, amount } = p.effect;
	const t = ledger.daos.get(p.daoId)?.treasury;
	return !!t && treasury.outgoing(t).some((x) => x.receiver === to && x.amount === amount);
}

export function start(): void {
	void (async () => {
		for (;;) {
			await ledger.nextChange(ledger.keys.all);
			for (const p of ledger.proposals.values()) void (p.outcome ? execute(p) : count(p.id));
		}
	})();
	// A deadline passes without a ledger event, a treasury fills up without one, and a failed
	// attempt is due again.
	setInterval(() => {
		for (const p of ledger.proposals.values()) void (p.outcome ? execute(p) : count(p.id));
	}, 30_000);
}

/** The next try after `n` failures: half a minute, then doubling, at most a quarter hour. */
const backoff = (n: number) => Math.min(30_000 * 2 ** (n - 1), 15 * 60_000);

function failed(id: string, e: unknown) {
	const reason = e instanceof Error ? e.message : String(e);
	const f = failures.get(id) ?? { count: 0, next: 0, reason };
	f.count++;
	f.reason = reason;
	f.next = Date.now() + backoff(f.count);
	failures.set(id, f);
	if (f.count >= STUCK_AFTER && !stuck.has(id)) {
		stuck.set(id, reason.slice(0, 300));
		ledger.notify(ledger.keys.proposal(id));
	}
	console.warn(
		`${id}: attempt ${f.count} failed; next in ${Math.round(backoff(f.count) / 1000)} s:`,
		reason
	);
}
const succeeded = (id: string) => {
	failures.delete(id);
	if (stuck.delete(id)) ledger.notify(ledger.keys.proposal(id));
};
const due = (id: string) => (failures.get(id)?.next ?? 0) <= Date.now();

/** Ballots the count can accept: cast by members of the time, before the deadline, oldest first. */
const countable = (p: ledger.Proposal) =>
	[...(ledger.ballots.get(p.id)?.values() ?? [])]
		.filter(
			(b) =>
				!b.counted &&
				!refused.has(b.contractId) &&
				b.daoId === p.daoId &&
				b.changeable === p.rule.changeable &&
				ledger.time(b.closesAt) === ledger.time(p.closesAt) &&
				ledger.eligible(p, b)
		)
		.sort((a, b) => ledger.time(a.castAt) - ledger.time(b.castAt));

async function count(id: string, only?: string[]) {
	if (counting.has(id)) {
		again.add(id);
		return;
	}
	const p = ledger.proposals.get(id);
	if (!p || p.outcome || !due(id)) return;
	const overdue = ledger.time(p.closesAt) <= Date.now();
	const settled = ledger.time(p.closesAt) + GRACE <= Date.now();
	if (p.rule.changeable && !overdue) return;
	const all = countable(p);
	const batch = (only ? all.filter((b) => only.includes(b.contractId)) : all).slice(0, BATCH);
	if (batch.length === 0 && !settled) return;
	const final = settled && all.length <= batch.length && !only;

	counting.add(id);
	try {
		const updateId = await submitAsProvider(
			[
				{
					ExerciseCommand: {
						templateId: Main.Proposal.templateId,
						contractId: p.contractId,
						choice: 'Proposal_Tally',
						choiceArgument: { ballots: batch.map((b) => b.contractId), final }
					}
				}
			],
			`tally-${id}-${p.contractId.slice(0, 12)}-${batch.length}-${Date.now()}`
		);
		// The next batch must see this one's result, or it would hand in ballots already counted.
		await ledger.applied(updateId);
		void billing.settle(p.daoId, updateId);
		succeeded(id);
		again.add(id);
	} catch (e) {
		// One ballot the ledger refuses would block the whole batch: narrow down to it, alone,
		// and leave it out from then on.
		if (batch.length > 1) {
			counting.delete(id);
			return count(
				id,
				batch.slice(0, Math.ceil(batch.length / 2)).map((b) => b.contractId)
			);
		}
		if (batch.length === 1) {
			refused.add(batch[0].contractId);
			console.warn(
				`Ballot ${batch[0].contractId.slice(0, 12)} refused by the ledger; left out:`,
				e instanceof Error ? e.message : e
			);
			again.add(id);
		} else failed(id, e);
	} finally {
		counting.delete(id);
	}
	if (again.delete(id)) setTimeout(() => void count(id), 1500);
}

const warn = (what: string, e: unknown) =>
	console.warn(`${what}; retrying later:`, e instanceof Error ? e.message : e);

/**
 * A passed proposal with an effect is carried out, with the DAO's authority: in one go, or a
 * batch of its entries at a time. A payout goes out of the treasury before it is recorded,
 * and waits while the treasury cannot cover it. Dissolving takes two steps: the DAO closes to
 * new proposals at once; then, once every other proposal has settled and been carried out
 * (a passed payout included), what is owed for traffic is collected, what is left goes where
 * the vote said, and the DAO is archived.
 */
async function execute(p: ledger.Proposal) {
	if (p.outcome !== 'Passed' || p.executedAt || p.effect.kind === 'signal') return;
	const dao = ledger.daos.get(p.daoId);
	if (!dao || executing.has(p.id) || !due(p.id)) return;
	executing.add(p.id);
	let ok = false;
	try {
		let upTo = 1;
		let current: string[] = [];
		switch (p.effect.kind) {
			case 'dissolve': {
				if (p.executed === 0) break; // step one: close the DAO to new proposals
				upTo = 2;
				const others = [...(ledger.proposalsOf.get(p.daoId)?.values() ?? [])].filter(
					(o) => o.id !== p.id
				);
				if (
					others.some(
						(o) =>
							!o.outcome || (o.outcome === 'Passed' && !o.executedAt && o.effect.kind !== 'signal')
					)
				)
					return;
				if (!paid.has(p.id)) {
					await billing.collectFrom(dao.id);
					if ((await treasury.holdings(dao.treasury, true)) > 0.1) {
						const updateId = await treasury.transferAll(
							dao.treasury,
							p.effect.remainderTo,
							`syncvotes: ${dao.name} dissolved`
						);
						markPaid(p.id, updateId);
						void billing.settle(p.daoId, updateId, dao.treasury);
					} else markPaid(p.id, 'nothing-left');
				}
				break;
			}
			case 'payout': {
				if (!paid.has(p.id)) {
					const balance = await billing.balance(p.daoId);
					if (balance < p.effect.amount + 0.5) return;
					const updateId = await treasury.transfer(
						dao.treasury,
						p.effect.to,
						p.effect.amount,
						`syncvotes: ${p.title}`
					);
					markPaid(p.id, updateId);
					void billing.settle(p.daoId, updateId, dao.treasury);
				}
				break;
			}
			case 'shares': {
				// The next batch of entries, with the contracts of those among them who are members.
				const slice = p.effect.changes.slice(p.executed, p.executed + BATCH);
				upTo = p.executed + slice.length;
				const members = ledger.members.get(p.daoId);
				current = slice.flatMap((c) => members?.get(c.party)?.contractId ?? []);
				break;
			}
		}
		const updateId = await submitAsProvider(
			[
				{
					ExerciseCommand: {
						templateId: Main.DAO.templateId,
						contractId: dao.contractId,
						choice: 'DAO_Execute',
						choiceArgument: { proposal: p.contractId, current, upTo: String(upTo) }
					}
				}
			],
			`execute-${p.id}-${dao.contractId.slice(0, 12)}-${upTo}-${Date.now()}`
		);
		await ledger.applied(updateId);
		void billing.settle(p.daoId, updateId);
		succeeded(p.id);
		ok = true;
	} catch (e) {
		failed(p.id, e);
		warn(`Executing ${p.id} failed`, e);
	} finally {
		executing.delete(p.id);
	}
	// A long share change goes on with the next batch as soon as this one is in the maps.
	const next = ledger.proposals.get(p.id);
	if (ok && next && !next.executedAt) setTimeout(() => void execute(next), 200);
}
