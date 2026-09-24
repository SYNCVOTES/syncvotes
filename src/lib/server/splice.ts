import { providerParty, scanUrl, type DisclosedContract } from './participant';

export { scanUrl };

/**
 * Canton Coin, as far as this app reads it: the network's rules and the open round (from
 * public Scan, disclosed to the transactions that need them), what a coin is worth, and what
 * the network charges for traffic. Nothing here signs or moves coin.
 */

type ScanContract = {
	template_id: string;
	contract_id: string;
	payload: Record<string, unknown>;
	created_event_blob: string;
};

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

export type Disclosed = DisclosedContract & { payload: Record<string, unknown>; dso: string };

const disclosed = (c: ScanContract, synchronizerId: string): Disclosed => ({
	templateId: c.template_id,
	contractId: c.contract_id,
	createdEventBlob: c.created_event_blob,
	synchronizerId,
	payload: c.payload,
	dso: String(c.payload.dso ?? '')
});

/** The AmuletRules contract of the moment: where the traffic price lives. */
export const amuletRules = cached(5 * 60_000, () =>
	scan<{ amulet_rules_update: { contract: ScanContract; domain_id: string } }>(
		'/api/scan/v0/amulet-rules',
		{}
	).then((r) => disclosed(r.amulet_rules_update.contract, r.amulet_rules_update.domain_id))
);

/** The open mining round of the moment: where the coin's price lives. */
export const openRound = cached(60_000, async () => {
	const r = await scan<{
		open_mining_rounds: Record<
			string,
			{ contract: ScanContract & { payload: { opensAt: string } }; domain_id: string }
		>;
	}>('/api/scan/v0/open-and-issuing-mining-rounds', {
		cached_open_mining_round_contract_ids: [],
		cached_issuing_round_contract_ids: []
	});
	const now = Date.now();
	const open = Object.values(r.open_mining_rounds)
		.filter((x) => new Date(x.contract.payload.opensAt).getTime() <= now)
		.sort((a, b) => a.contract.payload.opensAt.localeCompare(b.contract.payload.opensAt));
	if (open.length === 0) throw new Error('No open mining round');
	const last = open[open.length - 1];
	return disclosed(last.contract, last.domain_id);
});

/**
 * What comes back of what traffic costs, as fractions of it, from the latest issuing round: the
 * validator is minted `validator` coin per coin it burns buying traffic, and a featured app's
 * provider `featuredApp` per coin of its transactions' traffic, but only where the network mints
 * app rewards by traffic (CIP-0104; MainNet still mints by activity markers) and only above the
 * per-round threshold, in USD, below which a party's reward is burned.
 */
export const rewards = cached(10 * 60_000, async () => {
	const r = await scan<{
		issuing_mining_rounds: Record<string, { contract: ScanContract }>;
	}>('/api/scan/v0/open-and-issuing-mining-rounds', {
		cached_open_mining_round_contract_ids: [],
		cached_issuing_round_contract_ids: []
	});
	const latest = Object.values(r.issuing_mining_rounds)
		.map((x) => x.contract.payload as { round: { number: string } } & Record<string, string>)
		.sort((a, b) => Number(b.round.number) - Number(a.round.number))[0];
	const config = (
		(await amuletRules()).payload as {
			configSchedule: {
				initialValue: {
					rewardConfig?: { mintingVersion?: string; appRewardCouponThreshold?: string };
				};
			};
		}
	).configSchedule.initialValue.rewardConfig;
	const featured = await scan<{ featured_app_right: unknown }>(
		`/api/scan/v0/featured-apps/${encodeURIComponent(providerParty())}`
	).then((x) => x.featured_app_right !== null);
	return {
		validator: Number(latest?.issuancePerValidatorRewardCoupon ?? 0),
		featuredApp:
			featured && config?.mintingVersion === 'RewardVersion_TrafficBasedAppRewards'
				? Number(latest?.issuancePerFeaturedAppRewardCoupon ?? 0)
				: 0,
		thresholdUsd: Number(config?.appRewardCouponThreshold ?? 0.5)
	};
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
