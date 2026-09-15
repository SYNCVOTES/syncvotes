import { Main } from '@daml.js/model';
import { operatorParty, sdk } from './participant';

/**
 * One subscription to the ledger for the whole server: the operator observes every Account, DAO
 * and Proposal, so a single update stream over the participant's websocket sees every change
 * this app can show. Live queries wait on it and re-read when it fires — nothing polls.
 *
 * The SDK's stream ends when the socket does; this reconnects from the last offset it saw.
 */

const TEMPLATES = [Main.Account.templateId, Main.DAO.templateId, Main.Proposal.templateId];

let waiters = new Set<() => void>();
let started = false;

function fire() {
	const batch = waiters;
	waiters = new Set();
	for (const wake of batch) wake();
}

/** Resolves the next time the ledger changes something this app shows. */
export const nextChange = () => new Promise<void>((resolve) => waiters.add(resolve));

export function startFeed(): void {
	if (started) return;
	started = true;

	void (async () => {
		let offset: number | undefined;
		for (;;) {
			try {
				const ledger = await sdk();
				offset ??= await ledger.ledger.ledgerEnd();
				for await (const update of ledger.events.updates({
					partyId: operatorParty(),
					templateIds: TEMPLATES,
					beginOffset: offset,
					verbose: false
				})) {
					const seen = (update as { update?: { Transaction?: { value?: { offset?: number } } } })
						.update?.Transaction?.value?.offset;
					if (seen) offset = seen;
					fire();
				}
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
