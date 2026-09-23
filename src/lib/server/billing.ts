import { error } from '@sveltejs/kit';
import { Main } from '@daml.js/model';
import { BILLING_FACTOR } from '$app/env/private';
import * as ledger from './ledger';
import * as splice from './splice';
import * as deposits from './deposits';
import { operatorParty, paidTraffic, providerParty, sdk, submitAsProvider } from './participant';

/**
 * Who pays for what. Every transaction a DAO causes costs this validator traffic — bytes the
 * network charges in coin, at a price it publishes. The DAO pays that back into a balance:
 * coin anyone sends to the provider with the DAO's memo, found in the provider's own
 * transactions and credited at `factor` times the network's price (one to start with, less
 * once the rewards this traffic earns are known). The balance lives on the ledger as the
 * DAO's `Meter` — credited and charged, rewritten as the figures move; between writes the
 * charges are kept here. Reads are free; a write is refused when the balance is gone. What is
 * paid in is spent on traffic and is not paid back.
 */

/** Charges not yet written to the meter, in coin, by DAO id. */
const pending = new Map<string, number>();
/** DAOs whose meter needs writing. */
const dirty = new Set<string>();
let writing = false;

const factor = () => Number(BILLING_FACTOR ?? '1');

/** Coin per byte of traffic, right now. */
async function coinPerByte(): Promise<number> {
	const { usdPerMb, usdPerCoin } = await splice.prices();
	return (usdPerMb / 1_000_000 / usdPerCoin) * factor();
}

export type Statement = {
	/** Where to send coin, and the memo that credits it to this DAO. */
	payTo: string;
	memo: string;
	credited: number;
	charged: number;
	balance: number;
	/** Coin per megabyte, after the factor; what a byte costs the DAO. */
	coinPerMb: number;
	usdPerCoin: number;
	factor: number;
	updatedAt: string | null;
};

/** The DAO's account as it stands, meter plus what is not written yet. */
export async function statement(daoId: string): Promise<Statement> {
	if (!ledger.daos.has(daoId)) error(404, 'No such DAO');
	const meter = ledger.meters.get(daoId);
	const charged = (meter?.charged ?? 0) + (pending.get(daoId) ?? 0);
	const credited = meter?.credited ?? 0;
	const { usdPerMb, usdPerCoin } = await splice.prices();
	return {
		payTo: providerParty(),
		memo: deposits.memoFor(daoId),
		credited,
		charged,
		balance: credited - charged,
		coinPerMb: (usdPerMb / usdPerCoin) * factor(),
		usdPerCoin,
		factor: factor(),
		updatedAt: meter?.updatedAt ?? null
	};
}

/** What the DAO can still spend: paid in, less charged. */
export const balance = (daoId: string): number =>
	(ledger.meters.get(daoId)?.credited ?? 0) -
	(ledger.meters.get(daoId)?.charged ?? 0) -
	(pending.get(daoId) ?? 0);

/** Refuses a write for a DAO that has no coin left. */
export function funded(daoId: string): void {
	if (balance(daoId) <= 0) {
		throw error(402, "This DAO's balance is empty — someone has to pay in first");
	}
}

/** The traffic a transaction cost, charged to the DAO that caused it. */
export async function charge(daoId: string, bytes: number): Promise<void> {
	if (!bytes) return;
	const coin = bytes * (await coinPerByte());
	pending.set(daoId, (pending.get(daoId) ?? 0) + coin);
	dirty.add(daoId);
	ledger.notify(ledger.keys.dao(daoId));
	// Charges reach the ledger once they add up to something, or with the hourly write.
	if ((pending.get(daoId) ?? 0) > 0.5) void flush();
}

/** Looks up what a transaction cost and charges it; for writes the provider submitted too. */
export async function settle(daoId: string, updateId: string, party = providerParty()) {
	await charge(daoId, await paidTraffic(updateId, party));
}

async function write(daoId: string, credited: number, charged: number) {
	const dao = ledger.daos.get(daoId);
	if (!dao) return;
	const meter = ledger.meters.get(daoId);
	const updateId = meter
		? await submitAsProvider(
				[
					{
						ExerciseCommand: {
							templateId: Main.Meter.templateId,
							contractId: meter.contractId,
							choice: 'Meter_Update',
							choiceArgument: {
								newCredited: credited.toFixed(10),
								newCharged: charged.toFixed(10)
							}
						}
					}
				],
				`meter-${daoId}-${Date.now()}`
			)
		: await submitAsProvider(
				[
					{
						CreateCommand: {
							templateId: Main.Meter.templateId,
							createArguments: {
								provider: providerParty(),
								operator: operatorParty(),
								daoId,
								credited: credited.toFixed(10),
								charged: charged.toFixed(10),
								updatedAt: new Date().toISOString()
							}
						}
					}
				],
				`meter-${daoId}-${Date.now()}`
			);
	await ledger.applied(updateId);
}

/** Writes every meter with unwritten charges. One at a time; a failure waits for the next round. */
export async function flush(): Promise<void> {
	if (writing) return;
	writing = true;
	try {
		for (const daoId of [...dirty]) {
			const coin = pending.get(daoId) ?? 0;
			if (coin === 0 || !ledger.daos.has(daoId)) {
				dirty.delete(daoId);
				pending.delete(daoId);
				continue;
			}
			const meter = ledger.meters.get(daoId);
			try {
				await write(daoId, meter?.credited ?? 0, (meter?.charged ?? 0) + coin);
				pending.set(daoId, (pending.get(daoId) ?? 0) - coin);
				dirty.delete(daoId);
			} catch (e) {
				console.warn(`Meter of ${daoId} not written:`, e instanceof Error ? e.message : e);
			}
		}
	} finally {
		writing = false;
	}
}

// ---- Deposits: coin at the provider with a DAO's memo ---------------------------------------

/** Coin paid in so far, by DAO, as summed from the provider's transactions. */
const deposited = new Map<string, number>();
/** The transactions summed, so no window counts one twice. */
const summed = new Set<string>();
let seenOffset: number | undefined;
let watching = false;

function take(found: deposits.Deposit[]) {
	for (const d of found) {
		if (summed.has(d.updateId)) continue;
		summed.add(d.updateId);
		deposited.set(d.daoId, (deposited.get(d.daoId) ?? 0) + d.amount);
	}
}

/**
 * Reads a window of the provider's history, splitting it while the participant says it holds
 * more than it will list. Returns the oldest record time seen, or null for an empty window.
 */
async function window(after: number, before: number): Promise<string | null> {
	const got = await deposits.deposits(after, before);
	if (got) {
		take(got.found);
		return got.oldest;
	}
	const mid = Math.floor((after + before) / 2);
	if (mid <= after) return null;
	const a = await window(mid, before);
	const b = await window(after, mid);
	return b ?? a;
}

/**
 * Takes in what waits to be accepted, then credits what arrived with a memo. On the first
 * look, walks the provider's history back to before the oldest DAO existed, so the credited
 * sums are the ledger's, not this process's memory; after that, only what is new. The meter
 * is written only when its credited figure is behind the sum.
 */
export async function watchDeposits(): Promise<void> {
	if (watching) return;
	watching = true;
	try {
		try {
			await deposits.acceptIncoming();
		} catch (e) {
			console.warn('Incoming transfers not read:', e instanceof Error ? e.message : e);
		}
		const end = await (await sdk()).ledger.ledgerEnd();
		if (seenOffset === undefined) {
			const oldestDao = [...ledger.daos.values()].map((d) => d.createdAt).sort()[0];
			if (oldestDao) {
				let to = end;
				let step = 20_000;
				while (to > 0) {
					const from = Math.max(0, to - step);
					const oldest = await window(from, to);
					if (oldest && oldest < oldestDao) break;
					to = from;
					step = Math.min(step * 2, 200_000);
				}
			}
			seenOffset = end;
		} else if (end > seenOffset) {
			await window(seenOffset, end);
			seenOffset = end;
		}
		for (const [daoId, total] of deposited) {
			const meter = ledger.meters.get(daoId);
			if (!ledger.daos.has(daoId) || (meter?.credited ?? 0) >= total) continue;
			try {
				await write(daoId, total, (meter?.charged ?? 0) + (pending.get(daoId) ?? 0));
				pending.delete(daoId);
				dirty.delete(daoId);
				ledger.notify(ledger.keys.dao(daoId));
			} catch (e) {
				console.warn(`Deposit to ${daoId} not credited yet:`, e instanceof Error ? e.message : e);
			}
		}
	} catch (e) {
		console.warn('Deposits not read:', e instanceof Error ? e.message : e);
	} finally {
		watching = false;
	}
}

export function start(): void {
	void deposits
		.ensurePreapproval()
		.catch((e) =>
			console.warn('The provider has no transfer pre-approval:', e instanceof Error ? e.message : e)
		);
	void watchDeposits();
	setInterval(() => void watchDeposits(), 20_000);
	setInterval(() => void flush(), 60 * 60_000);
	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.once(signal, () => {
			void flush().finally(() => process.exit(0));
		});
	}
}
