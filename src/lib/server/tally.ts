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
 * until then; after the deadline the batch that empties the queue is final and decides the
 * outcome. A passed proposal with something to do gets a `DAO_Execute` per batch of its
 * entries; a payout moves the coin first and records it after. One count at a time per
 * proposal, since each replaces the contract. The ledger checks every ballot and every effect
 * it is handed, so this can only delay a result, never change it.
 */

const BATCH = 200;
const counting = new Set<string>();
const again = new Set<string>();
const executing = new Set<string>();

/**
 * Payouts made, by proposal id: the transfer's transaction. Kept on disk as well, so a
 * restart between the transfer and its record on the ledger cannot pay twice.
 */
export const paid = new Map<string, string>();
const PAID_FILE = `${STATE_DIR ?? '/data'}/paid.json`;
try {
	for (const [k, v] of Object.entries(JSON.parse(readFileSync(PAID_FILE, 'utf8')))) {
		paid.set(k, String(v));
	}
} catch {
	// Nothing paid yet, or no state directory: the map starts empty.
}
function markPaid(proposalId: string, updateId: string) {
	paid.set(proposalId, updateId);
	try {
		mkdirSync(PAID_FILE.slice(0, PAID_FILE.lastIndexOf('/')), { recursive: true });
		writeFileSync(PAID_FILE, JSON.stringify(Object.fromEntries(paid)));
	} catch (e) {
		console.warn('Payout record not written:', e instanceof Error ? e.message : e);
	}
}

export function start(): void {
	void (async () => {
		for (;;) {
			await ledger.nextChange(ledger.keys.all);
			for (const p of ledger.proposals.values()) void (p.outcome ? execute(p) : count(p.id));
		}
	})();
	// A deadline passes without a ledger event, and a treasury fills up without one.
	setInterval(() => {
		for (const p of ledger.proposals.values()) void (p.outcome ? execute(p) : count(p.id));
	}, 30_000);
}

/** Ballots the count can accept: cast by members of the time, before the deadline, oldest first. */
const countable = (p: ledger.Proposal) =>
	[...(ledger.ballots.get(p.id)?.values() ?? [])]
		.filter(
			(b) =>
				!b.counted &&
				b.daoId === p.daoId &&
				b.changeable === p.rule.changeable &&
				ledger.eligible(p, b)
		)
		.sort((a, b) => ledger.time(a.castAt) - ledger.time(b.castAt))
		.slice(0, BATCH);

async function count(id: string) {
	if (counting.has(id)) {
		again.add(id);
		return;
	}
	const p = ledger.proposals.get(id);
	if (!p || p.outcome) return;
	const overdue = ledger.time(p.closesAt) <= Date.now();
	if (p.rule.changeable && !overdue) return;
	const batch = countable(p);
	if (batch.length === 0 && !overdue) return;
	const final = overdue && batch.length < BATCH;

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
			`tally-${id}-${p.contractId.slice(0, 12)}-${batch.length}`
		);
		// The next batch must see this one's result, or it would hand in ballots already counted.
		await ledger.applied(updateId);
		void billing.settle(p.daoId, updateId);
	} catch (e) {
		console.warn(`Tally of ${id} failed; retrying later:`, e instanceof Error ? e.message : e);
		again.add(id);
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
 * and waits while the treasury cannot cover it. Dissolving waits until nothing else is open,
 * so no vote is cut short by the DAO vanishing under it, then sends what is left where the
 * vote said.
 */
async function execute(p: ledger.Proposal) {
	if (p.outcome !== 'Passed' || p.executedAt || p.effect.kind === 'signal') return;
	const dao = ledger.daos.get(p.daoId);
	if (!dao || executing.has(p.id)) return;
	executing.add(p.id);
	try {
		let upTo = 1;
		let current: string[] = [];
		switch (p.effect.kind) {
			case 'dissolve': {
				const others = [...(ledger.proposalsOf.get(p.daoId)?.values() ?? [])];
				if (others.some((o) => o.id !== p.id && !o.outcome)) return;
				if (!paid.has(p.id) && (await treasury.holdings(dao.treasury, true)) > 0.1) {
					const updateId = await treasury.transferAll(
						dao.treasury,
						p.effect.remainderTo,
						`syncvotes: ${dao.name} dissolved`
					);
					markPaid(p.id, updateId);
					void billing.settle(p.daoId, updateId, dao.treasury);
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
			`execute-${p.id}-${dao.contractId.slice(0, 12)}-${upTo}`
		);
		await ledger.applied(updateId);
		void billing.settle(p.daoId, updateId);
	} catch (e) {
		warn(`Executing ${p.id} failed`, e);
	} finally {
		executing.delete(p.id);
	}
	// A long share change goes on with the next batch as soon as this one is in the maps.
	const next = ledger.proposals.get(p.id);
	if (next && !next.executedAt) setTimeout(() => void execute(next), 200);
}
