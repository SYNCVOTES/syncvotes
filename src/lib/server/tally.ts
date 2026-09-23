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
 * Payouts and remainders, by proposal id: `sending` while a transfer is under way, then the
 * transfer's transaction with the instruction it left waiting (`<tx>|<cid>`, or `<tx>` where
 * the coin landed at once), `nothing-left` when there was nothing to send, `unpaid:<why>` when
 * it never went out, `returned:<n>` when it came back unaccepted (n times, for a remainder).
 * Kept on disk. Every transfer is submitted under one command id per payment, so a resend —
 * after a restart, or after an error that came back once the coin had gone — is refused by
 * the participant as a duplicate and recorded as sent, never paid twice.
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
	try {
		save();
	} catch (e) {
		// The map in memory still wins; a restart re-sends under the same command id and is refused.
		console.error('Payout record not written:', message(e));
	}
}
const wentOut = (id: string) => {
	const v = paid.get(id);
	return !!v && !v.startsWith('unpaid:') && !v.startsWith('returned:') && !v.startsWith('sending');
};
/** The instruction a sent payout left waiting, if any. */
const instructionOf = (id: string) => paid.get(id)?.split('|')[1] ?? null;
const RETURNS_BEFORE_GIVING_UP = 3;
/** A transfer under way, or one whose reply was lost: `sending:<attempt>`. */
const sending = (id: string) => paid.get(id)?.startsWith('sending') ?? false;
/** How many times a payment came back, from either marker. */
const attemptOf = (id: string) =>
	Number(paid.get(id)?.match(/^(?:returned|sending):(\d+)/)?.[1] ?? 0);

export type PayoutState =
	| 'pending' // passed, not sent yet
	| 'sending' // a transfer is under way, or was when the process last stopped
	| 'awaiting' // sent; waits for the receiver to accept it
	| 'returned' // not accepted in time; taken back into the treasury
	| 'paid'
	| 'unpaid'; // never sent: the DAO dissolved first, or the receiver joined the app

/** Where a payout stands, for the page. */
export function payoutState(p: ledger.Proposal): { state: PayoutState; note: string | null } {
	if (p.effect.kind !== 'payout') return { state: 'pending', note: null };
	const v = paid.get(p.id);
	if (!v) return { state: 'pending', note: null };
	if (v.startsWith('sending')) return { state: 'sending', note: null };
	if (v.startsWith('unpaid:')) return { state: 'unpaid', note: v.slice(7) };
	if (v.startsWith('returned:')) return { state: 'returned', note: null };
	const t = ledger.daos.get(p.daoId)?.treasury;
	const cid = instructionOf(p.id);
	if (t && cid && treasury.outgoing(t).some((x) => x.cid === cid)) {
		return { state: 'awaiting', note: null };
	}
	return { state: 'paid', note: null };
}

/** Sends coin under the payment's own command id and records what it left waiting. */
async function send(
	proposalId: string,
	daoTreasury: string,
	to: string,
	amount: number | 'all',
	memo: string
): Promise<void> {
	const before = paid.get(proposalId);
	const attempt = attemptOf(proposalId);
	const commandId = `${amount === 'all' ? 'remainder' : 'payout'}-${proposalId}-${attempt}`;
	markPaid(proposalId, `sending:${attempt}`);
	let updateId: string;
	try {
		updateId =
			amount === 'all'
				? await treasury.transferAll(daoTreasury, to, memo, commandId)
				: await treasury.transfer(daoTreasury, to, amount, memo, commandId);
	} catch (e) {
		if (e instanceof treasury.Duplicate) updateId = 'sent-before';
		else {
			// The participant said no, or nothing reached it: nothing went, so the payment is
			// where it was. Only a lost reply keeps it `sending`, to be resent under the same id.
			if (e instanceof treasury.Rejected) {
				if (before) markPaid(proposalId, before);
				else {
					paid.delete(proposalId);
					save();
				}
			}
			throw e;
		}
	}
	const out = await treasury.refreshOutgoing(daoTreasury);
	const known = new Set([...paid.values()].map((v) => v.split('|')[1]).filter(Boolean));
	const mine = out.find((x) => x.receiver === to && !known.has(x.cid));
	markPaid(proposalId, mine ? `${updateId}|${mine.cid}` : updateId);
	const daoId = [...ledger.daos.values()].find((d) => d.treasury === daoTreasury)?.id;
	if (daoId && updateId !== 'sent-before') void billing.settle(daoId, updateId, daoTreasury);
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
				// What is owed comes out first; then a payout the rest cannot cover, or one stuck
				// for good, is written off.
				await billing.collectFrom(dao.id);
				const balance = await billing.balance(dao.id);
				for (const o of undone) {
					if (o.effect.kind !== 'payout' || wentOut(o.id) || sending(o.id)) continue;
					if (stuck.has(o.id)) markPaid(o.id, `unpaid:${stuck.get(o.id)}`);
					else if (o.effect.amount + 0.5 > balance) {
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
					(o) => o.effect.kind === 'payout' && payoutState(o).state === 'awaiting'
				);
				if (sent.length) {
					waitFor(p.id, `${titles(sent)} to be accepted or to come back`);
					return;
				}
				// The remainder: sent, then waited for like a payout; taken back and sent again if
				// nobody accepts it, a few times; then the DAO is archived with what is left in it.
				const v = paid.get(p.id);
				if (!v || sending(p.id) || v.startsWith('returned:')) {
					if (ledger.accounts.has(p.effect.remainderTo)) {
						throw new Error(
							'the receiver of what is left joined SyncVotes after the vote; it cannot be sent to a party registered here'
						);
					}
					const returns = attemptOf(p.id);
					if (returns >= RETURNS_BEFORE_GIVING_UP && !sending(p.id)) {
						markPaid(
							p.id,
							'unpaid:what was left was not accepted three times; it stays in the treasury'
						);
					} else if ((await treasury.holdings(dao.treasury, true)) > 0.1) {
						waitFor(p.id, null);
						await send(
							p.id,
							dao.treasury,
							p.effect.remainderTo,
							'all',
							`syncvotes: ${dao.name} dissolved`
						);
					} else markPaid(p.id, 'nothing-left');
				}
				const cid = instructionOf(p.id);
				if (cid && treasury.outgoing(dao.treasury).some((x) => x.cid === cid)) {
					waitFor(p.id, 'what is left to be accepted at the receiving address');
					return;
				}
				waitFor(p.id, null);
				break;
			}
			case 'payout': {
				const v = paid.get(p.id);
				if (v?.startsWith('unpaid:')) break; // written off: recorded as carried out, unpaid
				if (!v || sending(p.id)) {
					if (ledger.accounts.has(p.effect.to)) {
						markPaid(
							p.id,
							'unpaid:the receiver joined SyncVotes after the vote; payouts go outside the app'
						);
						break;
					}
					// `sending`: a transfer was under way when the process last stopped, or the
					// participant answered late; sent again under the same command id, which the
					// participant refuses if the coin already went.
					if (!sending(p.id)) {
						const balance = await billing.balance(p.daoId);
						if (balance < p.effect.amount + 0.5) {
							waitFor(p.id, 'the treasury to cover it');
							return;
						}
					}
					waitFor(p.id, null);
					await send(p.id, dao.treasury, p.effect.to, p.effect.amount, `syncvotes: ${p.title}`);
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
		// A transfer that failed stays `sending`: the next try uses the same command id, so a
		// coin that did go out is not sent twice.
		failed(p.id, e);
	} finally {
		executing.delete(p.id);
	}
	// A long share change goes on with the next batch as soon as this one is in the maps.
	const next = ledger.proposals.get(p.id);
	if (ok && next && !next.executedAt) setTimeout(() => void execute(next), 200);
}

/**
 * Coin a treasury sent that was never accepted: once its instruction has run out, taken back
 * into the treasury, and the payout it was is recorded as returned — by the instruction, so
 * two equal payouts are told apart. Locks left without an instruction are released as well.
 */
export async function releaseReturns(): Promise<void> {
	for (const dao of ledger.daos.values()) {
		try {
			const back = await treasury.withdrawExpired(dao.treasury);
			// A lock is released on its own only once no instruction of its time still stands:
			// withdrawing is what closes both, and a lock gone under a standing instruction
			// leaves that instruction unclosable.
			const released = treasury.expiredStanding(dao.treasury)
				? []
				: await treasury.releaseExpired(dao.treasury);
			if (!back.length && !released.length) continue;
			for (const p of ledger.proposalsOf.get(dao.id)?.values() ?? []) {
				const cid = instructionOf(p.id);
				if (!cid || !back.some((b) => b.cid === cid)) continue;
				const returns = Number(paid.get(p.id)?.match(/^returned:(\d+)$/)?.[1] ?? 0);
				markPaid(p.id, `returned:${returns + 1}`);
				ledger.notify(ledger.keys.proposal(p.id));
			}
			ledger.notify(ledger.keys.dao(dao.id));
		} catch (e) {
			console.warn(`Taking back returns of ${dao.id} failed:`, message(e));
		}
	}
}

// A payout accepted at its address is news for its page.
treasury.watchOutgoing((_, cids) => {
	for (const [id, v] of paid) {
		if (cids.includes(v.split('|')[1] ?? '')) ledger.notify(ledger.keys.proposal(id));
	}
});
