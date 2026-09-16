import { Main } from '@daml.js/model';
import { submitAsProvider } from './participant';
import * as index from './index';
import { uncounted } from './app';

/**
 * The provider's one job after a vote: count. Each open proposal with uncounted ballots gets a
 * `Proposal_Tally` of up to a batch of them; after the deadline the last batch is marked final
 * and decides the outcome. One count at a time per proposal, since each replaces the contract.
 * The ledger checks every ballot it is handed, so this can only delay a result, never change it.
 */

const BATCH = 200;
const inFlight = new Set<string>();
const queued = new Set<string>();

export function startTally(): void {
	// Anything that changes a proposal or lands a ballot is a reason to look again.
	void (async () => {
		for (;;) {
			await index.nextChange(index.keys.all);
			for (const p of index.proposals.values()) void consider(p.id);
		}
	})();
	// Deadlines pass without a ledger event.
	setInterval(() => {
		for (const p of index.proposals.values()) void consider(p.id);
	}, 30_000);
}

async function consider(id: string) {
	if (inFlight.has(id)) {
		queued.add(id);
		return;
	}
	const p = index.proposals.get(id);
	if (!p || !p.ready || p.outcome) return;
	const batch = uncounted(id, BATCH);
	const overdue = new Date(p.closesAt).getTime() <= Date.now();
	if (batch.length === 0 && !overdue) return;
	// After the deadline no ballot can be cast, so the batch that empties the queue is final.
	const final = overdue && batch.length < BATCH;

	inFlight.add(id);
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
		queued.add(id);
	} finally {
		inFlight.delete(id);
	}
	if (queued.delete(id)) setTimeout(() => void consider(id), 1500);
}
