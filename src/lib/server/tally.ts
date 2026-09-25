import { Templates } from '$lib/templates';
import * as markers from './markers';
import { submitAsProvider } from './participant';
import * as ledger from './ledger';
import * as billing from './billing';

/**
 * The provider's jobs: count, and carry out. Every proposal with uncounted ballots gets a
 * `Proposal_Tally` of a batch of them — once the deadline has passed, where votes may change
 * until then; a few minutes after the deadline (ballots signed at the last moment still
 * arrive) the batch that empties the queue is final and decides the outcome. A passed
 * proposal with something to do gets a `DAO_Execute` per batch of its entries. One count at a
 * time per proposal, since each replaces the contract, and never on a contract the copy has not
 * caught up with. What fails is retried
 * later, less and less often, and after enough failures the proposal says why it is stuck. A
 * ballot the ledger itself refuses is found by halving the batch and left out; any other
 * failure is the network's and is waited out. The ledger checks every ballot and every effect
 * it is handed, so this can only delay a result, never change it.
 */

const BATCH = 200;
/** Who pays the provider's transactions on a proposal: the DAO, or its proposer where members pay. */
const payer = (p: ledger.Proposal): billing.Account =>
	ledger.daos.get(p.daoId)?.actorPays
		? billing.purseOfParty(p.proposer)
		: billing.daoAccount(p.daoId);
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

export function start(): void {
	void (async () => {
		for (;;) {
			await ledger.nextChange(ledger.keys.all);
			for (const p of ledger.proposals.values()) void (p.outcome ? execute(p) : count(p.id));
		}
	})();
	// A deadline passes without a ledger event, and a failed attempt is due again.
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
	if (!p || p.outcome || !due(id) || !ledger.daos.has(p.daoId)) return;
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
								templateId: Templates.Proposal.templateId,
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
				void billing.settle(payer(p), updateId);
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
 * batch of its entries at a time. A dissolution archives the DAO at once: what was open is
 * moot, what was paid in is spent, the record stays readable.
 */
async function execute(p: ledger.Proposal) {
	if (
		p.outcome !== 'Passed' ||
		p.executedAt ||
		p.effect.kind === 'signal' ||
		p.effect.kind === 'choose'
	)
		return;
	const dao = ledger.daos.get(p.daoId);
	if (!dao || executing.has(p.id) || !due(p.id)) return;
	if (consumedDao.get(p.daoId) === dao.contractId) return;
	executing.add(p.id);
	let ok = false;
	try {
		let upTo = 1;
		let current: string[] = [];
		switch (p.effect.kind) {
			case 'shares': {
				// The next batch of entries, with the contracts of those among them who are members.
				const slice = p.effect.changes.slice(p.executed, p.executed + BATCH);
				upTo = p.executed + slice.length;
				const members = ledger.members.get(p.daoId);
				current = slice.flatMap((c) => members?.get(c.party)?.contractId ?? []);
				break;
			}
		}
		// The change's marker is recorded once, with the batch that completes it.
		const size = p.effect.kind === 'shares' ? p.effect.changes.length : 1;
		const right = upTo === size ? await markers.right() : null;
		const updateId = await submitAsProvider(
			[
				{
					ExerciseCommand: {
						templateId: Templates.DAO.templateId,
						contractId: dao.contractId,
						choice: 'DAO_Execute',
						choiceArgument: {
							proposal: p.contractId,
							current,
							upTo: String(upTo),
							featuredAppRight: right?.contractId ?? null
						}
					}
				}
			],
			`execute-${p.id}-${dao.contractId.slice(0, 12)}-${upTo}-${Date.now()}`,
			right ? [right] : []
		);
		consumedDao.set(p.daoId, dao.contractId);
		ok = await ledger.applied(updateId);
		void billing.settle(payer(p), updateId, undefined, !!right);
		succeeded(p.id);
		waitFor(p.id, null);
	} catch (e) {
		failed(p.id, e);
	} finally {
		executing.delete(p.id);
	}
	// A long share change goes on with the next batch as soon as this one is in the maps.
	const next = ledger.proposals.get(p.id);
	if (ok && next && !next.executedAt) setTimeout(() => void execute(next), 200);
}
