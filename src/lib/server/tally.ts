import { Main } from '@daml.js/model';
import { submitAsProvider } from './participant';
import * as ledger from './ledger';
import * as billing from './billing';

/**
 * The provider's jobs: count, and carry out. Every proposal with uncounted ballots gets a
 * `Proposal_Tally` of a batch of them; after the deadline the batch that empties the queue is
 * final and decides the outcome. A passed proposal with something to do gets a `DAO_Execute`.
 * One count at a time per proposal, since each replaces the contract. The ledger checks every
 * ballot and every effect it is handed, so this can only delay a result, never change it.
 */

const BATCH = 200;
const counting = new Set<string>();
const again = new Set<string>();
const executing = new Set<string>();

export function start(): void {
	void (async () => {
		for (;;) {
			await ledger.nextChange(ledger.keys.all);
			for (const p of ledger.proposals.values()) void (p.outcome ? execute(p) : count(p.id));
		}
	})();
	// A deadline passes without a ledger event.
	setInterval(() => {
		for (const id of ledger.proposals.keys()) void count(id);
	}, 30_000);
}

/** Ballots the count can accept: cast by members of the time, before the deadline, oldest first. */
const countable = (p: ledger.Proposal) =>
	[...(ledger.ballots.get(p.id)?.values() ?? [])]
		.filter((b) => !b.counted && b.daoId === p.daoId && ledger.eligible(p, b))
		.sort((a, b) => ledger.time(a.castAt) - ledger.time(b.castAt))
		.slice(0, BATCH);

async function count(id: string) {
	if (counting.has(id)) {
		again.add(id);
		return;
	}
	const p = ledger.proposals.get(id);
	if (!p || p.outcome) return;
	const batch = countable(p);
	const overdue = ledger.time(p.closesAt) <= Date.now();
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
		void billing.settle(p.daoId, updateId);
	} catch (e) {
		console.warn(`Tally of ${id} failed; retrying later:`, e instanceof Error ? e.message : e);
		again.add(id);
	} finally {
		counting.delete(id);
	}
	if (again.delete(id)) setTimeout(() => void count(id), 1500);
}

/** A passed proposal with an effect is carried out once, with the DAO's authority. */
async function execute(p: ledger.Proposal) {
	if (p.outcome !== 'Passed' || p.executedAt || p.effect.kind === 'signal') return;
	const dao = ledger.daos.get(p.daoId);
	if (!dao || executing.has(p.id)) return;
	if (p.effect.kind === 'payout' && !dao.treasury) return;
	const removals =
		p.effect.kind === 'members'
			? p.effect.remove
					.map((party) => ledger.members.get(p.daoId)?.get(party))
					.filter((m): m is ledger.Member => !!m && m.party !== dao.creator)
					.map((m) => m.contractId)
			: [];
	executing.add(p.id);
	try {
		const updateId = await submitAsProvider(
			[
				{
					ExerciseCommand: {
						templateId: Main.DAO.templateId,
						contractId: dao.contractId,
						choice: 'DAO_Execute',
						choiceArgument: { proposal: p.contractId, removals }
					}
				}
			],
			`execute-${p.id}-${dao.contractId.slice(0, 12)}`
		);
		void billing.settle(p.daoId, updateId);
	} catch (e) {
		console.warn(`Executing ${p.id} failed; retrying later:`, e instanceof Error ? e.message : e);
	} finally {
		executing.delete(p.id);
	}
}
