import { Main } from '@daml.js/model';
import { submitAsProvider } from './participant';
import * as ledger from './ledger';

/**
 * The provider's two jobs: open every proposal it sees, and count. Every open proposal with uncounted ballots gets a
 * `Proposal_Tally` of a batch of them; after the deadline the batch that empties the queue is
 * final and decides the outcome. One count at a time per proposal, since each replaces the
 * contract. The ledger checks every ballot it is handed, so this can only delay a result.
 */

const BATCH = 200;
const counting = new Set<string>();
const again = new Set<string>();

export function start(): void {
	void (async () => {
		for (;;) {
			await ledger.nextChange(ledger.keys.all);
			for (const p of ledger.proposals.values()) void (p.openedAt ? count(p.id) : open(p));
		}
	})();
	// A deadline passes without a ledger event.
	setInterval(() => {
		for (const id of ledger.proposals.keys()) void count(id);
	}, 30_000);
}

const opening = new Set<string>();

/** Fixes the electorate: the DAO's member count as of now, read off the DAO contract. */
async function open(p: ledger.Proposal) {
	const dao = ledger.daos.get(p.daoId);
	if (!dao || opening.has(p.id)) return;
	opening.add(p.id);
	try {
		await submitAsProvider(
			[
				{
					ExerciseCommand: {
						templateId: Main.Proposal.templateId,
						contractId: p.contractId,
						choice: 'Proposal_Open',
						choiceArgument: { dao: dao.contractId }
					}
				}
			],
			`open-${p.id}`
		);
	} catch (e) {
		console.warn(`Opening ${p.id} failed; retrying later:`, e instanceof Error ? e.message : e);
	} finally {
		opening.delete(p.id);
	}
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
	if (!p || !p.openedAt || p.outcome) return;
	const batch = countable(p);
	const overdue = ledger.time(p.closesAt) <= Date.now();
	if (batch.length === 0 && !overdue) return;
	const final = overdue && batch.length < BATCH;

	counting.add(id);
	try {
		await submitAsProvider(
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
	} catch (e) {
		console.warn(`Tally of ${id} failed; retrying later:`, e instanceof Error ? e.message : e);
		again.add(id);
	} finally {
		counting.delete(id);
	}
	if (again.delete(id)) setTimeout(() => void count(id), 1500);
}
