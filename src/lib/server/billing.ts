import { error } from '@sveltejs/kit';
import { Templates } from '$lib/templates';
import { BILLING_FACTOR, BILLING_FLOOR } from '$app/env/private';
import * as ledger from './ledger';
import * as splice from './splice';
import * as deposits from './deposits';
import { paidTraffic, payeeParty, providerParty, sdk, submitAsProvider } from './participant';

/**
 * Who pays for what. Every transaction costs this validator traffic — bytes the network
 * charges in coin, at a price it publishes — and is charged to an account: a DAO's balance
 * (its `Meter`) or a party's own (its `Purse`), at `factor` times the network's price. Both
 * are paid in the same way: coin sent to the provider with the account's memo, found in the
 * provider's own transactions and credited here. A DAO pays for everything done in it unless
 * it was founded with each member paying for what they sign; a party pays for itself — its
 * allocation, its profile, the DAOs it founds. The figures live on the ledger, rewritten as
 * they move; between writes the charges are kept here. Reads are free; a write is refused
 * when the balance is gone, or would not cover what the participant says it will cost. What
 * is paid in is spent on traffic and is not paid back.
 */

/** An account: `dao:<id>` or `purse:<fingerprint>`. */
export type Account = `dao:${string}` | `purse:${string}`;
export const daoAccount = (id: string): Account => `dao:${id}`;
export const purseAccount = (fingerprint: string): Account => `purse:${fingerprint}`;
export const purseOfParty = (party: string): Account => purseAccount(party.split('::')[1] ?? '');
const split = (a: Account) =>
	a.startsWith('dao:')
		? { kind: 'dao' as const, key: a.slice(4) }
		: { kind: 'purse' as const, key: a.slice(6) };

/** Charges not yet written to the ledger, in coin, by account. */
const pending = new Map<Account, number>();
/** Accounts whose contract needs writing. */
const dirty = new Set<Account>();
let writing = false;

/** The traffic charged lately, for how much of it there is per round (ten minutes). */
const recent: { at: number; bytes: number }[] = [];
const HOUR = 3600_000;
const bytesPerRound = () => {
	const since = Date.now() - HOUR;
	while (recent.length && recent[0].at < since) recent.shift();
	return recent.reduce((s, r) => s + r.bytes, 0) / 6;
};

/**
 * What a byte is charged at, as a fraction of what it costs: what does not come back as rewards
 * (the validator's for the traffic it buys; the provider's where it earns app rewards for it,
 * enough per round to clear the threshold), times `BILLING_FACTOR`, below one to subsidise. Where
 * rewards come to all of it or more, the net is nothing; `BILLING_FLOOR` still charges that
 * fraction of the price, so payers pay something even then.
 */
async function factor(): Promise<number> {
	const [back, { usdPerMb }] = await Promise.all([splice.rewards(), splice.prices()]);
	const appUsdPerRound = (bytesPerRound() / 1_000_000) * usdPerMb * back.featuredApp;
	const app = appUsdPerRound >= back.thresholdUsd ? back.featuredApp : 0;
	const net = Math.max(0, 1 - back.validator - app);
	return Math.max(net * Number(BILLING_FACTOR ?? '1'), Number(BILLING_FLOOR ?? '0'));
}

/**
 * What a transaction of `bytes` is charged, in coin. As `coinFor`, and where it recorded an
 * activity marker and the network mints by marker, less what the marker brings, before the
 * factor applies; never below `BILLING_FLOOR` of the price.
 */
async function chargeFor(bytes: number, marked: boolean): Promise<number> {
	const [back, { usdPerMb, usdPerCoin }] = await Promise.all([splice.rewards(), splice.prices()]);
	if (!marked || back.markerUsd === 0) return coinFor(bytes);
	const gross = ((bytes / 1_000_000) * usdPerMb) / usdPerCoin;
	const appUsdPerRound = (bytesPerRound() / 1_000_000) * usdPerMb * back.featuredApp;
	const app = appUsdPerRound >= back.thresholdUsd ? back.featuredApp : 0;
	const net = Math.max(0, gross * (1 - back.validator - app) - back.markerUsd / usdPerCoin);
	return Math.max(net * Number(BILLING_FACTOR ?? '1'), gross * Number(BILLING_FLOOR ?? '0'));
}

/** Coin per byte of traffic, right now. */
async function coinPerByte(): Promise<number> {
	const { usdPerMb, usdPerCoin } = await splice.prices();
	return (usdPerMb / 1_000_000 / usdPerCoin) * (await factor());
}
/** What this many bytes cost, in coin. */
export const coinFor = async (bytes: number) => bytes * (await coinPerByte());

/** The bytes a party's allocation costs beyond its topology: the Account it gets. Measured. */
let accountBytes = 1500;
/** What the last party's topology came to, in bytes; the estimate before one is measured. */
let topologyBytes = 1600;

/**
 * What a write in flight will make the ledger say. A charge leaves `pending` the moment its
 * write is submitted and is counted here until the ledger's copy shows it, so it is never
 * counted twice (once in the copy, once still pending) nor not at all.
 */
const expected = new Map<Account, { credited: number; charged: number }>();

/** The figures for an account: the ledger's, or what a write in flight will make them. */
const figures = (a: Account): { credited: number; charged: number; exists: boolean } => {
	const { kind, key } = split(a);
	const row = kind === 'dao' ? ledger.meters.get(key) : ledger.purses.get(key);
	const ahead = expected.get(a);
	if (ahead && row && row.charged >= ahead.charged && row.credited >= ahead.credited) {
		expected.delete(a); // the copy has caught up
	}
	return {
		credited: Math.max(row?.credited ?? 0, expected.get(a)?.credited ?? 0),
		charged: Math.max(row?.charged ?? 0, expected.get(a)?.charged ?? 0),
		exists: !!row || !!expected.get(a)
	};
};

/** Puts a write in flight: the amounts count as the ledger's from now, the charge is no longer pending. */
function ahead(a: Account, credited: number, charged: number) {
	expected.set(a, { credited, charged });
}

/** What an account can still spend: paid in, less charged, less what is not written yet. */
export const balance = (a: Account): number => {
	const f = figures(a);
	// A purse not yet on the ledger holds what arrived for its key in the meantime.
	const credited = f.exists ? f.credited : (deposited.get(a) ?? 0);
	return credited - f.charged - (pending.get(a) ?? 0);
};

const emptyMessage = (a: Account) =>
	split(a).kind === 'dao'
		? "The DAO's balance is empty. Top it up first."
		: 'Your balance is empty. Top up on the Wallet page.';

/**
 * Whether traffic costs payers nothing on this deployment: `BILLING_FACTOR` 0 (a test network,
 * say), or rewards that come to the whole of it. Then no balance is needed for anything.
 */
export const free = async () => (await factor()) === 0;

/** Refuses a write for an account with nothing left, or not enough for what it will cost. */
export async function funded(a: Account, costBytes = 0): Promise<void> {
	if (await free()) return;
	const have = balance(a);
	if (have <= 0) throw error(402, emptyMessage(a));
	const cost = await coinFor(costBytes);
	if (cost > have) {
		throw error(
			402,
			`This costs about ${cost.toFixed(2)} CC; ${split(a).kind === 'dao' ? "the DAO's balance" : 'your balance'} is ${have.toFixed(2)} CC. Top up first.`
		);
	}
}

export type Statement = {
	/** Where to send coin, and the memo that credits it to this account. */
	payTo: string;
	memo: string;
	credited: number;
	charged: number;
	balance: number;
	/** Coin per megabyte, after the factor; what a byte costs. */
	coinPerMb: number;
	usdPerCoin: number;
	factor: number;
	/** Nothing is charged here: no balance is needed, and none is asked for. */
	free: boolean;
	updatedAt: string | null;
};

/** The account as it stands: ledger plus what is not written yet. */
export async function statement(a: Account): Promise<Statement> {
	const { kind, key } = split(a);
	const row = kind === 'dao' ? ledger.meters.get(key) : ledger.purses.get(key);
	const f = figures(a);
	const { usdPerMb, usdPerCoin } = await splice.prices();
	const credited = f.exists ? f.credited : (deposited.get(a) ?? 0);
	const charged = f.charged + (pending.get(a) ?? 0);
	const now = await factor();
	return {
		payTo: payeeParty(),
		memo: deposits.memoFor(a),
		credited,
		charged,
		balance: credited - charged,
		coinPerMb: (usdPerMb / usdPerCoin) * now,
		usdPerCoin,
		factor: Math.round(now * 100) / 100,
		free: now === 0,
		updatedAt: row?.updatedAt ?? null
	};
}

/** The traffic a transaction cost, charged to the account that caused it. */
export async function charge(a: Account, bytes: number, marked = false): Promise<void> {
	if (!bytes) return;
	recent.push({ at: Date.now(), bytes });
	const coin = await chargeFor(bytes, marked);
	pending.set(a, (pending.get(a) ?? 0) + coin);
	dirty.add(a);
	notify(a);
	// Charges reach the ledger once they add up to something, or with the hourly write.
	if ((pending.get(a) ?? 0) > 0.5) void flush();
}

const notify = (a: Account) => {
	const { kind, key } = split(a);
	ledger.notify(kind === 'dao' ? ledger.keys.dao(key) : ledger.keys.purse(key));
};

/** Looks up what a transaction cost and charges it; for writes the provider submitted too. */
export async function settle(
	a: Account,
	updateId: string,
	party = providerParty(),
	marked = false
) {
	await charge(a, await paidTraffic(updateId, party), marked);
}

async function write(a: Account, credited: number, charged: number, party?: string) {
	const { kind, key } = split(a);
	if (kind === 'dao' && !ledger.daos.has(key)) return;
	const row = kind === 'dao' ? ledger.meters.get(key) : ledger.purses.get(key);
	const amounts = { newCredited: credited.toFixed(10), newCharged: charged.toFixed(10) };
	const commandId = `${kind}-${key.slice(0, 24)}-${Date.now()}`;
	const updateId = row
		? await submitAsProvider(
				[
					{
						ExerciseCommand: {
							templateId: kind === 'dao' ? Templates.Meter.templateId : Templates.Purse.templateId,
							contractId: row.contractId,
							choice: kind === 'dao' ? 'Meter_Update' : 'Purse_Update',
							choiceArgument:
								kind === 'dao'
									? amounts
									: { ...amounts, newParty: party ?? ledger.purses.get(key)?.party ?? null }
						}
					}
				],
				commandId
			)
		: await submitAsProvider(
				[
					{
						CreateCommand: {
							templateId: kind === 'dao' ? Templates.Meter.templateId : Templates.Purse.templateId,
							createArguments: {
								provider: providerParty(),
								...(kind === 'dao' ? { daoId: key } : { fingerprint: key, party: party ?? null }),
								credited: credited.toFixed(10),
								charged: charged.toFixed(10),
								updatedAt: new Date().toISOString()
							}
						}
					}
				],
				commandId
			);
	await ledger.applied(updateId);
}

/** Writes every account with unwritten charges. One at a time; a failure waits for the next round. */
export async function flush(): Promise<void> {
	if (writing) return;
	writing = true;
	try {
		for (const a of [...dirty]) {
			const coin = pending.get(a) ?? 0;
			const { kind, key } = split(a);
			// A DAO that is gone, or a purse whose party was never allocated, is not written. A party
			// with an Account but no Purse yet (one that came back after the provider changed) is.
			const party =
				kind === 'purse'
					? (ledger.purses.get(key)?.party ??
						[...ledger.accounts.keys()].find((p) => p.split('::')[1] === key) ??
						null)
					: null;
			const gone = kind === 'dao' ? !ledger.daos.has(key) : !party;
			if (coin === 0 || gone) {
				dirty.delete(a);
				pending.delete(a);
				continue;
			}
			const f = figures(a);
			// An account not on the ledger yet holds what arrived for it so far; the contract that
			// is written for it starts from that, not from nothing.
			const credited = f.exists ? f.credited : (deposited.get(a) ?? 0);
			// The charge moves from pending to the figures as the write goes out, not as it lands.
			pending.set(a, (pending.get(a) ?? 0) - coin);
			ahead(a, credited, f.charged + coin);
			notify(a);
			try {
				await write(a, credited, f.charged + coin, party ?? undefined);
				dirty.delete(a);
			} catch (e) {
				pending.set(a, (pending.get(a) ?? 0) + coin);
				expected.delete(a);
				notify(a);
				console.warn(`${a} not written:`, e instanceof Error ? e.message : e);
			}
		}
	} finally {
		writing = false;
	}
}

// ---- A party's allocation, paid from its purse ------------------------------------------------

/** What a new party costs: its topology and its Account, in coin, at today's price. */
export const enrolCost = async (topologyBytesNow = topologyBytes) =>
	coinFor(topologyBytesNow + accountBytes);

/** What arrived for a key, allocated or not. */
export const credit = (fingerprint: string) => balance(purseAccount(fingerprint));

/**
 * The purse is opened the moment the party is allocated: everything that arrived for the
 * key is credited, the allocation is charged. The Account's own transaction is measured
 * and charged with it, and its size remembered for the next estimate.
 */
export async function openPurse(
	fingerprint: string,
	party: string,
	topologyBytesUsed: number,
	accountUpdateId: string | null
): Promise<void> {
	const a = purseAccount(fingerprint);
	topologyBytes = topologyBytesUsed;
	const bytes = accountUpdateId ? await paidTraffic(accountUpdateId, providerParty()) : 0;
	if (bytes > 0) accountBytes = bytes;
	const charged = await coinFor(topologyBytesUsed + bytes);
	await write(a, deposited.get(a) ?? 0, charged, party);
	notify(a);
}

// ---- Deposits: coin at the provider with an account's memo ----------------------------------

/** Coin paid in so far, by account, as summed from the provider's transactions. */
const deposited = new Map<Account, number>();
/** The transactions summed, so no window counts one twice. */
const summed = new Set<string>();
let seenOffset: number | undefined;
let watching = false;

function take(found: deposits.Deposit[]) {
	for (const d of found) {
		if (summed.has(d.updateId)) continue;
		summed.add(d.updateId);
		deposited.set(d.account, (deposited.get(d.account) ?? 0) + d.amount);
		notify(d.account);
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
 * look, walks the provider's history back to before the oldest account existed — and a week
 * further, for coin sent for a key whose party is not allocated yet — so the credited sums
 * are the ledger's, not this process's memory; after that, only what is new. A contract is
 * written only when its credited figure is behind the sum; a purse whose party is not
 * allocated has no contract, and its sum waits here for the key to come back.
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
			const oldest = [
				...[...ledger.daos.values()].map((d) => d.createdAt),
				...[...ledger.purses.values()].map((p) => p.updatedAt)
			].sort()[0];
			const week = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
			const floor = oldest && oldest < week ? oldest : week;
			let to = end;
			let step = 20_000;
			while (to > 0) {
				const from = Math.max(0, to - step);
				const seen = await window(from, to);
				if (seen && seen < floor) break;
				to = from;
				step = Math.min(step * 2, 200_000);
			}
			seenOffset = end;
		} else if (end > seenOffset) {
			await window(seenOffset, end);
			seenOffset = end;
		}
		for (const [a, total] of deposited) {
			const f = figures(a);
			if (!f.exists || f.credited >= total) continue;
			const coin = pending.get(a) ?? 0;
			pending.delete(a);
			ahead(a, total, f.charged + coin);
			notify(a);
			try {
				await write(a, total, f.charged + coin);
				dirty.delete(a);
			} catch (e) {
				pending.set(a, (pending.get(a) ?? 0) + coin);
				expected.delete(a);
				notify(a);
				console.warn(`Deposit to ${a} not credited yet:`, e instanceof Error ? e.message : e);
			}
		}
	} catch (e) {
		console.warn('Deposits not read:', e instanceof Error ? e.message : e);
	} finally {
		watching = false;
	}
}

export function start(): void {
	const preapprove = () =>
		deposits
			.ensurePreapproval()
			.catch((e) =>
				console.warn(
					'The provider has no transfer pre-approval:',
					e instanceof Error ? e.message : e
				)
			);
	void preapprove();
	setInterval(() => void preapprove(), 24 * 3600 * 1000);
	void watchDeposits();
	setInterval(() => void watchDeposits(), 20_000);
	setInterval(() => void flush(), 60 * 60_000);
	// The provider's rewards go to the wallet that buys the traffic, hourly.
	const sweep = () =>
		deposits
			.sweepToPayee()
			.catch((e) =>
				console.warn('Provider coin not moved to the payee:', e instanceof Error ? e.message : e)
			);
	void sweep();
	setInterval(() => void sweep(), 60 * 60_000);
	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.once(signal, () => {
			void flush().finally(() => process.exit(0));
		});
	}
}
