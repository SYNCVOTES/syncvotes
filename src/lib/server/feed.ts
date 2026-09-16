import { operatorParty, sdk, streamActiveContracts } from './participant';
import * as index from './index';

/**
 * One subscription to the ledger for the whole server. The operator observes every contract of
 * the app's templates, so the update stream is everything the index needs: created and archived
 * events applied in order, one `commit` per transaction. Startup reads the active contracts
 * first, then follows the stream from the offset it read them at.
 *
 * The SDK's stream ends when the socket does; this reconnects from the last offset it saw.
 */

type Event =
	| {
			CreatedEvent: {
				contractId: string;
				templateId: string;
				createArgument: Record<string, unknown>;
			};
	  }
	| { ArchivedEvent: { contractId: string } };
type Update = { update?: { Transaction?: { value?: { offset?: number; events?: Event[] } } } };

let started = false;

async function bootstrap(): Promise<number> {
	const ledger = await sdk();
	const offset = await ledger.ledger.ledgerEnd();
	let n = 0;
	await streamActiveContracts(operatorParty(), index.TEMPLATES, offset, (c) => {
		index.created(c);
		n++;
	});
	index.commit();
	console.log(`Index built from ${n} active contracts at offset ${offset}`);
	return offset;
}

export function startFeed(): void {
	if (started) return;
	started = true;

	void (async () => {
		let offset: number | undefined;
		for (;;) {
			try {
				offset ??= await bootstrap();
				const ledger = await sdk();
				for await (const update of ledger.events.updates({
					partyId: operatorParty(),
					templateIds: index.TEMPLATES,
					beginOffset: offset,
					verbose: false
				})) {
					const tx = (update as Update).update?.Transaction?.value;
					if (!tx) continue;
					for (const e of tx.events ?? []) {
						if ('CreatedEvent' in e) index.created(e.CreatedEvent);
						else if ('ArchivedEvent' in e) index.archived(e.ArchivedEvent.contractId);
					}
					index.commit();
					if (tx.offset) offset = tx.offset;
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

/** Resolves the next time anything under `key` changes. */
export const nextChange = index.nextChange;
