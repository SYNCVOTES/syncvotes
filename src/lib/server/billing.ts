import { error } from '@sveltejs/kit';
import { Main } from '@daml.js/model';
import { BILLING_FACTOR } from '$app/env/private';
import * as ledger from './ledger';
import * as splice from './splice';
import * as treasury from './treasury';
import { operatorParty, paidTraffic, providerParty, submitAsProvider } from './participant';

/**
 * Who pays for what. Every transaction a DAO causes costs this validator traffic — bytes the
 * network charges in coin, at a price it publishes. The DAO pays that back from its treasury,
 * at `factor` times the network's price (one to start with, less once the rewards this
 * traffic earns are known). What the DAO's transactions cost, and what of that the treasury
 * has paid the provider so far, lives on the ledger as the DAO's `Meter`; between writes the
 * charges are kept here. The balance a DAO can spend is the treasury's coin less what it owes.
 * Reads are free; a write is refused when the balance is gone. What is owed is collected —
 * one transfer from the treasury to the provider — once it adds up, so the network's fee for
 * the transfer stays small next to what it settles.
 */

/** Charges not yet written to the meter, in coin, by DAO id. */
const pending = new Map<string, number>();
/** DAOs whose meter needs writing. */
const dirty = new Set<string>();
let writing = false;
let collecting = false;

const factor = () => Number(BILLING_FACTOR ?? '1');
/** What is owed before it is worth a transfer, in coin. */
const COLLECT_AT = 10;
/** Or how long it may wait. */
const COLLECT_AFTER = 7 * 24 * 3600 * 1000;
const collectedAt = new Map<string, number>();
const bootedAt = Date.now();

/** Coin per byte of traffic, right now. */
async function coinPerByte(): Promise<number> {
	const { usdPerMb, usdPerCoin } = await splice.prices();
	return (usdPerMb / 1_000_000 / usdPerCoin) * factor();
}

export type Statement = {
	/** The treasury party: where coin is sent. */
	treasury: string;
	/** What the treasury holds. */
	holdings: number;
	charged: number;
	collected: number;
	/** Charged and not yet collected. */
	due: number;
	/** Holdings less what is due: what the DAO can still spend. */
	balance: number;
	/** Coin per megabyte, after the factor; what a byte costs the DAO. */
	coinPerMb: number;
	usdPerCoin: number;
	factor: number;
	updatedAt: string | null;
};

const owed = (daoId: string) => {
	const meter = ledger.meters.get(daoId);
	return (meter?.charged ?? 0) - (meter?.collected ?? 0) + (pending.get(daoId) ?? 0);
};

/** The DAO's account as it stands, meter plus what is not written yet. */
export async function statement(daoId: string): Promise<Statement> {
	const dao = ledger.daos.get(daoId);
	if (!dao) error(404, 'No such DAO');
	const meter = ledger.meters.get(daoId);
	const charged = (meter?.charged ?? 0) + (pending.get(daoId) ?? 0);
	const collected = meter?.collected ?? 0;
	const [{ usdPerMb, usdPerCoin }, holdings] = await Promise.all([
		splice.prices(),
		treasury.holdings(dao.treasury)
	]);
	return {
		treasury: dao.treasury,
		holdings,
		charged,
		collected,
		due: charged - collected,
		balance: holdings - (charged - collected),
		coinPerMb: (usdPerMb / usdPerCoin) * factor(),
		usdPerCoin,
		factor: factor(),
		updatedAt: meter?.updatedAt ?? null
	};
}

/** What the DAO can still spend: the treasury's coin less what it owes. */
export async function balance(daoId: string): Promise<number> {
	const dao = ledger.daos.get(daoId);
	if (!dao) return 0;
	return (await treasury.holdings(dao.treasury)) - owed(daoId);
}

/** Refuses a write for a DAO that has no coin left. */
export async function funded(daoId: string): Promise<void> {
	if ((await balance(daoId)) <= 0) {
		throw error(402, "This DAO's treasury is empty — someone has to pay in first");
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

async function write(daoId: string, charged: number, collected: number) {
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
								newCharged: charged.toFixed(10),
								newCollected: collected.toFixed(10)
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
								treasury: dao.treasury,
								charged: charged.toFixed(10),
								collected: collected.toFixed(10),
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
				await write(daoId, (meter?.charged ?? 0) + coin, meter?.collected ?? 0);
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

/**
 * What each DAO owes, collected from its treasury once it is worth a transfer — or once a
 * week regardless. The transfer is the DAO's transaction too, and is charged like any other.
 */
export async function collect(): Promise<void> {
	if (collecting) return;
	collecting = true;
	try {
		await flush();
		for (const dao of ledger.daos.values()) {
			const meter = ledger.meters.get(dao.id);
			const due = (meter?.charged ?? 0) - (meter?.collected ?? 0);
			const since = collectedAt.get(dao.id) ?? bootedAt;
			if (due <= 0.01 || (due < COLLECT_AT && Date.now() - since < COLLECT_AFTER)) continue;
			if ((await treasury.holdings(dao.treasury, true)) < due + 0.5) continue;
			try {
				const updateId = await treasury.transfer(
					dao.treasury,
					providerParty(),
					due,
					`syncvotes traffic ${dao.id}`
				);
				collectedAt.set(dao.id, Date.now());
				await write(dao.id, meter?.charged ?? 0, (meter?.collected ?? 0) + due);
				void settle(dao.id, updateId, dao.treasury);
				ledger.notify(ledger.keys.dao(dao.id));
			} catch (e) {
				console.warn(`Collecting from ${dao.id} failed:`, e instanceof Error ? e.message : e);
			}
		}
	} finally {
		collecting = false;
	}
}

let accepting = false;

/** Coin sent to a treasury and waiting for it: taken in, one DAO after another. */
async function acceptIncoming(): Promise<void> {
	if (accepting) return;
	accepting = true;
	try {
		for (const dao of ledger.daos.values()) {
			try {
				if (await treasury.acceptIncoming(dao.treasury)) ledger.notify(ledger.keys.dao(dao.id));
			} catch (e) {
				console.warn(`Incoming coin of ${dao.id} not read:`, e instanceof Error ? e.message : e);
			}
		}
	} finally {
		accepting = false;
	}
}

export function start(): void {
	setInterval(() => void acceptIncoming(), 30_000);
	setInterval(() => void collect(), 10 * 60_000);
	setInterval(() => void flush(), 60 * 60_000);
	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.once(signal, () => {
			void flush().finally(() => process.exit(0));
		});
	}
}
