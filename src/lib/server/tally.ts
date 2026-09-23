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
 * the contract, and never on a contract the copy has not caught up with. What fails is retried
 * later, less and less often, and after enough failures the proposal says why it is stuck. A
 * ballot the ledger itself refuses is found by halving the batch and left out; any other
 * failure is the network's and is waited out. The ledger checks every ballot and every effect
 * it is handed, so this can only delay a result, never change it.
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
/** What a passed proposal is waiting for; for the page. */
export const waiting = new Map<string, string>();
const STUCK_AFTER = 5;
/**
 * The contract each proposal's last count consumed, and the DAO contract each DAO's last
 * execution consumed: until the copy shows a newer one, nothing is submitted against it.
 */
const consumedProposal = new Map<string, string>();
const consumedDao = new Map<string, string>();

/** What the ledger says when it refuses a ballot in `Ballot_Count`: that ballot's fault, nobody else's. */
const BALLOT_REFUSED =
	/Already counted|A ballot for another proposal|A ballot under another authority|Cast after the deadline|Cast against another deadline|Cast against another rule|Joined after the vote opened|The share changed after the vote opened/;

/**
 * Payouts and remainders, by proposal id: the transfer's transaction, `sending` while one is
 * under way, `nothing-left` when there was nothing to send, `unpaid:<why>` when it never
 * went out, `returned:<transaction>` when it came back unaccepted. Kept on disk, so a restart
 * between the transfer and its record cannot pay twice — and a transfer interrupted by a
 * restart is never sent again, only pointed at.
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
function save() {
	mkdirSync(PAID_FILE.slice(0, PAID_FILE.lastIndexOf('/')), { recursive: true });
	writeFileSync(PAID_FILE, JSON.stringify(Object.fromEntries(paid)));
}
function markPaid(proposalId: string, value: string) {
	paid.set(proposalId, value);
	save();
}
const wentOut = (id: string) => {
	const v = paid.get(id);
	return !!v && !v.startsWith('unpaid:');
};

export type PayoutState =
	| 'pending' // passed, not sent yet
	| 'sending' // a transfer was under way when the process last stopped
	| 'awaiting' // sent; waits for the receiver to accept it
	| 'locked' // not accepted in time; the coin is locked until the app releases it
	| 'returned' // released back to the treasury
	| 'paid'
	| 'unpaid'; // never sent: the DAO dissolved first, or the receiver joined the app

/** Where a payout stands, for the page. */
export function payoutState(p: ledger.Proposal): { state: PayoutState; note: string | null } {
	if (p.effect.kind !== 'payout') return { state: 'pending', note: null };
	const v = paid.get(p.id);
	if (!v) return { state: 'pending', note: null };
	if (v === 'sending') {
		return {
			state: 'sending',
			note: 'A transfer was under way when the app last restarted; it is not sent again. Check the treasury.'
		};
	}
	if (v.startsWith('unpaid:')) return { state: 'unpaid', note: v.slice(7) };
	if (v.startsWith('returned:')) return { state: 'returned', note: null };
	const t = ledger.daos.get(p.daoId)?.treasury;
	if (!t) return { state: 'paid', note: null };
	const { to, amount } = p.effect;
	if (treasury.outgoing(t).some((x) => x.receiver === to && x.amount === amount)) {
		return { state: 'awaiting', note: null };
	}
	if (treasury.lockedOf(t).some((x) => x.amount === amount)) return { state: 'locked', note: null };
	return { state: 'paid', note: null };
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
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function failed(id: string, e: unknown) {
	const reason = message(e);
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
function waitFor(id: string, what: string | null) {
	if (what === (waiting.get(id) ?? null)) return;
	if (what) waiting.set(id, what);
	else waiting.delete(id);
	ledger.notify(ledger.keys.proposal(id));
}

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

async function count(id: string) {
	if (counting.has(id)) {
		again.add(id);
		return;
	}
	const p = ledger.proposals.get(id);
	if (!p || p.outcome || !due(id)) return;
	// The last count consumed this contract; the copy has not seen its successor yet.
	if (consumedProposal.get(id) === p.contractId) return;
	const overdue = ledger.time(p.closesAt) <= Date.now();
	const settled = ledger.time(p.closesAt) + GRACE <= Date.now();
	if (p.rule.changeable && !overdue) return;
	const all = countable(p);
	if (all.length === 0 && !settled) return;

	counting.add(id);
	try {
		// A batch, narrowed by halves while the ledger refuses a ballot in it, until the one
		// refused stands alone and is left out. Any other failure is waited out.
		let batch = all.slice(0, BATCH);
		for (;;) {
			const final = settled && all.length <= batch.length;
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
				consumedProposal.set(id, p.contractId);
				// The next batch must see this one's result, or it would hand in ballots already counted.
				await ledger.applied(updateId);
				void billing.settle(p.daoId, updateId);
				succeeded(id);
				again.add(id);
				break;
			} catch (e) {
				if (!BALLOT_REFUSED.test(message(e)) || batch.length === 0) {
					failed(id, e);
					break;
				}
				if (batch.length === 1) {
					refused.add(batch[0].contractId);
					console.warn(
						`Ballot ${batch[0].contractId.slice(0, 12)} refused by the ledger; left out:`,
						message(e)
					);
					again.add(id);
					break;
				}
				batch = batch.slice(0, Math.ceil(batch.length / 2));
			}
		}
	} finally {
		counting.delete(id);
	}
	if (again.delete(id)) setTimeout(() => void count(id), 1500);
}

/**
 * A passed proposal with an effect is carried out, with the DAO's authority: in one go, or a
 * batch of its entries at a time. A payout goes out of the treasury before it is recorded,
 * and waits while the treasury cannot cover it. Dissolving takes two steps: the DAO closes to
 * new proposals at once; then, once every other proposal has settled and been carried out —
 * a payout the treasury cannot cover, or one stuck for good, is written off as unpaid — what
 * is owed for traffic is collected, what is left goes where the vote said, and the DAO is
 * archived.
 */
async function execute(p: ledger.Proposal) {
	if (p.outcome !== 'Passed' || p.executedAt || p.effect.kind === 'signal') return;
	const dao = ledger.daos.get(p.daoId);
	if (!dao || executing.has(p.id) || !due(p.id)) return;
	if (consumedDao.get(p.daoId) === dao.contractId) return;
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
					(o) => o.id !== p.id && o.effect.kind !== 'dissolve'
				);
				const titles = (list: ledger.Proposal[]) => list.map((o) => `“${o.title}”`).join(', ');
				const open = others.filter((o) => !o.outcome);
				if (open.length) {
					waitFor(p.id, `the vote on ${titles(open)}`);
					return;
				}
				const undone = others.filter(
					(o) => o.outcome === 'Passed' && !o.executedAt && o.effect.kind !== 'signal'
				);
				// A payout that cannot be covered, or that is stuck for good, is written off.
				const holdings = await treasury.holdings(dao.treasury, true);
				for (const o of undone) {
					if (o.effect.kind !== 'payout' || wentOut(o.id)) continue;
					if (stuck.has(o.id)) markPaid(o.id, `unpaid:${stuck.get(o.id)}`);
					else if (o.effect.amount + 0.5 > holdings) {
						markPaid(o.id, 'unpaid:the DAO dissolved before the treasury could cover it');
					}
					ledger.notify(ledger.keys.proposal(o.id));
				}
				const still = undone.filter(
					(o) => !(o.effect.kind === 'payout' && paid.get(o.id)?.startsWith('unpaid:'))
				);
				if (still.length) {
					waitFor(p.id, `${titles(still)} to be carried out`);
					return;
				}
				// Coin sent and not yet accepted still belongs to the treasury: wait for it to land
				// or come back before what is left goes out.
				const sent = others.filter(
					(o) => o.effect.kind === 'payout' && ['awaiting', 'locked'].includes(payoutState(o).state)
				);
				if (sent.length) {
					waitFor(p.id, `${titles(sent)} to be accepted or to come back`);
					return;
				}
				waitFor(p.id, null);
				if (!paid.has(p.id)) {
					await billing.collectFrom(dao.id);
					if ((await treasury.holdings(dao.treasury, true)) > 0.1) {
						markPaid(p.id, 'sending');
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
				const v = paid.get(p.id);
				if (v === 'sending') return; // interrupted by a restart: pointed at, never sent again
				if (v?.startsWith('unpaid:')) break; // written off: recorded as carried out, unpaid
				if (!v) {
					if (ledger.accounts.has(p.effect.to)) {
						markPaid(
							p.id,
							'unpaid:the receiver joined SyncVotes after the vote; payouts go outside the app'
						);
						break;
					}
					const balance = await billing.balance(p.daoId);
					if (balance < p.effect.amount + 0.5) {
						waitFor(p.id, 'the treasury to cover it');
						return;
					}
					waitFor(p.id, null);
					markPaid(p.id, 'sending');
					const updateId = await treasury.transfer(
						dao.treasury,
						p.effect.to,
						p.effect.amount,
						`syncvotes: ${p.title}`
					);
					markPaid(p.id, updateId);
					void billing.settle(p.daoId, updateId, dao.treasury);
					void treasury.refreshOutgoing(dao.treasury);
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
		consumedDao.set(p.daoId, dao.contractId);
		ok = await ledger.applied(updateId);
		void billing.settle(p.daoId, updateId);
		succeeded(p.id);
		waitFor(p.id, null);
	} catch (e) {
		if (paid.get(p.id) === 'sending') {
			// The transfer itself failed before anything went out: try again later.
			paid.delete(p.id);
			save();
		}
		failed(p.id, e);
	} finally {
		executing.delete(p.id);
	}
	// A long share change goes on with the next batch as soon as this one is in the maps.
	const next = ledger.proposals.get(p.id);
	if (ok && next && !next.executedAt) setTimeout(() => void execute(next), 200);
}

/**
 * Coin a treasury sent that was never accepted: once its lock has run out, released back to
 * the treasury, and the payout it was is recorded as returned.
 */
export async function releaseReturns(): Promise<void> {
	for (const dao of ledger.daos.values()) {
		try {
			const released = await treasury.releaseExpired(dao.treasury);
			if (!released.length) continue;
			for (const p of ledger.proposalsOf.get(dao.id)?.values() ?? []) {
				if (p.effect.kind !== 'payout' || !wentOut(p.id)) continue;
				const amount = p.effect.amount;
				if (released.some((r) => r.amount === amount)) {
					markPaid(p.id, `returned:${paid.get(p.id)}`);
					ledger.notify(ledger.keys.proposal(p.id));
				}
			}
			ledger.notify(ledger.keys.dao(dao.id));
		} catch (e) {
			console.warn(`Releasing returns of ${dao.id} failed:`, message(e));
		}
	}
}
