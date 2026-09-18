import { error } from '@sveltejs/kit';
import { Main } from '@daml.js/model';
import { BILLING_FACTOR } from '$app/env/private';
import * as ledger from './ledger';
import * as splice from './splice';
import { operatorParty, paidTraffic, providerParty, submitAsProvider } from './participant';

/**
 * Who pays for what. Every transaction a DAO causes costs this validator traffic — bytes the
 * network charges in coin, at a price it publishes. The DAO pays that back from a balance it
 * tops up with coin sent to the provider, at `factor` times the network's price: one to start
 * with, less once the rewards this traffic earns are known. The balance lives on the ledger as
 * the DAO's `Meter`, rewritten as the figures move; between writes the charges are kept here.
 * Reads are free; a write is refused when the balance is gone.
 */

/** Charges not yet written to the meter, in coin, by DAO id. */
const pending = new Map<string, number>();
/** DAOs whose meter needs writing, and when it was last written. */
const dirty = new Set<string>();
let writing = false;

const factor = () => Number(BILLING_FACTOR ?? '1');

/** Coin per byte of traffic, right now. */
async function coinPerByte(): Promise<number> {
	const { usdPerMb, usdPerCoin } = await splice.prices();
	return (usdPerMb / 1_000_000 / usdPerCoin) * factor();
}

/** What a transaction of `bytes` would cost the DAO, in coin. */
export async function quote(bytes: number): Promise<number> {
	return bytes * (await coinPerByte());
}

export type Statement = {
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
	const meter = ledger.meters.get(daoId);
	const charged = (meter?.charged ?? 0) + (pending.get(daoId) ?? 0);
	const credited = meter?.credited ?? 0;
	const { usdPerMb, usdPerCoin } = await splice.prices();
	return {
		credited,
		charged,
		balance: credited - charged,
		coinPerMb: (usdPerMb / usdPerCoin) * factor(),
		usdPerCoin,
		factor: factor(),
		updatedAt: meter?.updatedAt ?? null
	};
}

export const balance = (daoId: string) =>
	(ledger.meters.get(daoId)?.credited ?? 0) -
	(ledger.meters.get(daoId)?.charged ?? 0) -
	(pending.get(daoId) ?? 0);

/** Refuses a write for a DAO that has no coin left. */
export function funded(daoId: string): void {
	if (balance(daoId) <= 0) {
		throw error(402, "This DAO's balance is empty — an admin has to top it up first");
	}
}

/** The traffic a transaction cost, charged to the DAO that caused it. */
export async function charge(daoId: string, bytes: number): Promise<void> {
	if (!bytes) return;
	const coin = await quote(bytes);
	pending.set(daoId, (pending.get(daoId) ?? 0) + coin);
	dirty.add(daoId);
	ledger.notify(ledger.keys.dao(daoId));
	// Charges reach the ledger once they add up to something: a fraction of the balance, or
	// the daily write, whichever comes first.
	if ((pending.get(daoId) ?? 0) > Math.max(0.05, balance(daoId) * 0.01)) void flush();
}

/** Looks up what a transaction cost and charges it; for writes the provider submitted too. */
export async function settle(daoId: string, updateId: string, party = providerParty()) {
	await charge(daoId, await paidTraffic(updateId, party));
}

/** Coin that arrived for a DAO: written to the meter at once, so a restart cannot lose it. */
export async function credit(daoId: string, coin: number): Promise<void> {
	const meter = ledger.meters.get(daoId);
	await write(daoId, (meter?.credited ?? 0) + coin, meter?.charged ?? 0);
}

async function write(daoId: string, credited: number, charged: number) {
	const dao = ledger.daos.get(daoId);
	const meter = ledger.meters.get(daoId);
	const admins = dao?.admins ?? [];
	const updateId = meter
		? await submitAsProvider(
				[
					{
						ExerciseCommand: {
							templateId: Main.Meter.templateId,
							contractId: meter.contractId,
							choice: 'Meter_Update',
							choiceArgument: {
								newAdmins: admins,
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
								admins,
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

export function start(): void {
	setInterval(() => void flush(), 60 * 60 * 1000);
	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.once(signal, () => {
			void flush().finally(() => process.exit(0));
		});
	}
}
