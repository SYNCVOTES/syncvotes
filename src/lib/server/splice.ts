import { providerParty, scanUrl, sdk } from './participant';

/**
 * Canton Coin, as far as this app touches it: what the network charges for traffic and what a
 * coin is worth (from public Scan), and the coin that arrives at the provider — a DAO's admin
 * pays the DAO's balance in by sending coin to the provider with the DAO's reference as the
 * transfer's memo. Nothing here signs or moves coin.
 */

type ScanContract = { payload: Record<string, unknown> };

async function scan<T>(path: string, body?: unknown): Promise<T> {
	const r = await fetch(scanUrl() + path, {
		method: body === undefined ? 'GET' : 'POST',
		headers: { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	if (!r.ok) throw new Error(`Scan ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
	return r.json() as Promise<T>;
}

const cached = <T>(ttl: number, load: () => Promise<T>) => {
	let value: { at: number; promise: Promise<T> } | undefined;
	return () => {
		if (!value || Date.now() - value.at > ttl) {
			const promise = load().catch((e) => {
				value = undefined;
				throw e;
			});
			value = { at: Date.now(), promise };
		}
		return value.promise;
	};
};

/** The AmuletRules contract of the moment: where the traffic price lives. */
const amuletRules = cached(5 * 60_000, () =>
	scan<{ amulet_rules_update: { contract: ScanContract } }>('/api/scan/v0/amulet-rules', {}).then(
		(r) => r.amulet_rules_update.contract
	)
);

/** The open mining round of the moment: where the coin's price lives. */
const openRound = cached(60_000, async () => {
	const r = await scan<{
		open_mining_rounds: Record<
			string,
			{ contract: ScanContract & { payload: { opensAt: string } } }
		>;
	}>('/api/scan/v0/open-and-issuing-mining-rounds', {
		cached_open_mining_round_contract_ids: [],
		cached_issuing_round_contract_ids: []
	});
	const now = Date.now();
	const open = Object.values(r.open_mining_rounds)
		.map((x) => x.contract)
		.filter((c) => new Date(c.payload.opensAt).getTime() <= now)
		.sort((a, b) => a.payload.opensAt.localeCompare(b.payload.opensAt));
	if (open.length === 0) throw new Error('No open mining round');
	return open[open.length - 1];
});

/** What the network charges for traffic, in USD per megabyte, and what a coin is worth in USD. */
export const prices = cached(60_000, async () => {
	const rules = (await amuletRules()).payload as {
		configSchedule: {
			initialValue: { decentralizedSynchronizer: { fees: { extraTrafficPrice: string } } };
		};
	};
	const round = (await openRound()).payload as unknown as { amuletPrice: string };
	return {
		usdPerMb: Number(
			rules.configSchedule.initialValue.decentralizedSynchronizer.fees.extraTrafficPrice
		),
		usdPerCoin: Number(round.amuletPrice)
	};
});

/** The memo a transfer carries to be credited to a DAO. */
export const memoFor = (daoId: string) => `syncvotes:${daoId}`;
const MEMO = /^syncvotes:([0-9a-f-]{36})$/;

export type Deposit = {
	daoId: string;
	amount: number;
	from: string;
	updateId: string;
	offset: number;
};

/**
 * Coin that arrived at the provider after `afterOffset`, carrying a DAO's memo: the token
 * standard's view of the provider's transactions, filtered to transfers in. Everything else
 * that lands (fees, rewards, unmarked coin) is the provider's own.
 */
export async function deposits(afterOffset?: number): Promise<Deposit[]> {
	const found = await (await sdk()).token.holdings({ partyId: providerParty(), afterOffset });
	const out: Deposit[] = [];
	for (const tx of found.transactions) {
		for (const e of tx.events) {
			if (e.label.type !== 'TransferIn') continue;
			const daoId = e.label.reason?.match(MEMO)?.[1];
			if (!daoId) continue;
			const amount = Number(e.unlockedHoldingsChangeSummary?.amountChange ?? 0);
			if (amount > 0)
				out.push({ daoId, amount, from: e.label.sender, updateId: tx.updateId, offset: tx.offset });
		}
	}
	return out;
}
