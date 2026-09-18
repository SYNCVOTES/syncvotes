import { error } from '@sveltejs/kit';
import {
	VALIDATOR_API_URL,
	VALIDATOR_AUTH_CLIENT_ID,
	VALIDATOR_AUTH_CLIENT_SECRET,
	LEDGER_AUTH_URL
} from '$app/env/private';
import {
	activeContracts,
	providerParty,
	scanUrl,
	sdk,
	type Created,
	type DisclosedContract
} from './participant';

/**
 * Canton Coin, as this app touches it: the network's rules and rounds from public Scan (the
 * contracts a transfer has to disclose), a party's holdings, the commands to move, lock and
 * release coin, and the validator's door to a transfer pre-approval. Nothing here signs.
 */

export const INSTRUMENT_ID = 'Amulet';
const AMULET = '#splice-amulet:Splice.Amulet:Amulet';
const LOCKED = '#splice-amulet:Splice.Amulet:LockedAmulet';
export const SETUP_PROPOSAL = '#splice-amulet:Splice.AmuletRules:ExternalPartySetupProposal';
export const PREAPPROVAL = '#splice-amulet:Splice.AmuletRules:TransferPreapproval';

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

type Rules = {
	contract: ScanContract & {
		payload: {
			dso: string;
			configSchedule: {
				initialValue: {
					decentralizedSynchronizer: { fees: { extraTrafficPrice: string } };
				};
			};
		};
	};
	domain_id: string;
};

/** The AmuletRules contract of the moment: every coin transfer names and discloses it. */
export const amuletRules = cached(5 * 60_000, () =>
	scan<{ amulet_rules_update: Rules }>('/api/scan/v0/amulet-rules', {}).then(
		(r) => r.amulet_rules_update
	)
);

/** The open mining round to transfer in: the latest one that has opened. */
export const openRound = cached(60_000, async () => {
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

/** The DSO party: the instrument admin of Canton Coin. */
export const dsoParty = async () => (await amuletRules()).contract.payload.dso;

/** Canton Coin, as the token standard names it. */
export const instrument = async () => ({ admin: await dsoParty(), id: INSTRUMENT_ID });

/** What the network charges for traffic, in USD per megabyte, and what a coin is worth in USD. */
export const prices = cached(60_000, async () => {
	const rules = await amuletRules();
	const round = await openRound();
	return {
		usdPerMb: Number(
			rules.contract.payload.configSchedule.initialValue.decentralizedSynchronizer.fees
				.extraTrafficPrice
		),
		usdPerCoin: Number((round.payload as unknown as { amuletPrice: string }).amuletPrice)
	};
});

const disclose = (c: ScanContract, synchronizerId: string): DisclosedContract => ({
	templateId: c.template_id,
	contractId: c.contract_id,
	createdEventBlob: c.created_event_blob,
	synchronizerId
});

/** The AmuletRules and the open round, ready to disclose with a transfer or a release. */
export async function transferContext() {
	const rules = await amuletRules();
	const round = await openRound();
	return {
		rules,
		round,
		disclosed: [disclose(rules.contract, rules.domain_id), disclose(round, rules.domain_id)]
	};
}

// ---- Holdings -----------------------------------------------------------------------------

export type Holding = {
	contractId: string;
	templateId: string;
	/** Initial amount; the coin's holding fee makes the real figure slightly lower over time. */
	amount: number;
	/** When locked: the moment the owner can release it, and the note the lock carries. */
	lock: { expiresAt: string; context: string | null } | null;
};

type AmuletPayload = {
	amulet?: { amount: { initialAmount: string } };
	amount?: { initialAmount: string };
	lock?: { expiresAt: string; optContext: string | null };
};

const holding = (c: Created): Holding => {
	const a = c.createArgument as AmuletPayload;
	return {
		contractId: c.contractId,
		templateId: c.templateId,
		amount: Number(a.amulet?.amount.initialAmount ?? a.amount?.initialAmount ?? 0),
		lock: a.lock ? { expiresAt: a.lock.expiresAt, context: a.lock.optContext } : null
	};
};

/** A party's coin: free and locked, straight from the participant. */
export async function holdings(party: string): Promise<Holding[]> {
	const found = await activeContracts(party, [AMULET, LOCKED]);
	return found.map(holding).sort((a, b) => b.amount - a.amount);
}

// ---- Commands, for the party to sign ------------------------------------------------------

export type Command = { ExerciseCommand: Record<string, unknown> };

/** A coin transfer through the token standard. `memo` rides in the transfer's metadata. */
export async function transferCommand(
	sender: string,
	recipient: string,
	amount: string,
	memo?: string
): Promise<[Command, DisclosedContract[]]> {
	const [command, disclosed] = await (
		await sdk()
	).token.transfer.create({
		sender,
		recipient,
		amount,
		instrumentId: INSTRUMENT_ID,
		registryUrl: scanUrl(),
		memo
	});
	return [command as Command, disclosed as DisclosedContract[]];
}

/**
 * Locks `amount` of the owner's free coin until `expiresAt`, with nobody able to open it
 * sooner: a lock with no holders is a lock only time can open. The rest of the inputs comes
 * back to the owner as change.
 */
export async function lockCommand(
	owner: string,
	amount: string,
	expiresAt: string,
	context: string
): Promise<[Command, DisclosedContract[]]> {
	const free = (await holdings(owner)).filter((h) => !h.lock);
	if (free.length === 0) throw error(400, 'No free coin to lock');
	const { rules, round, disclosed } = await transferContext();
	const command: Command = {
		ExerciseCommand: {
			templateId: rules.contract.template_id,
			contractId: rules.contract.contract_id,
			choice: 'AmuletRules_Transfer',
			choiceArgument: {
				transfer: {
					sender: owner,
					provider: owner,
					inputs: free.slice(0, 50).map((h) => ({ tag: 'InputAmulet', value: h.contractId })),
					outputs: [
						{
							receiver: owner,
							receiverFeeRatio: '0.0000000000',
							amount,
							lock: { holders: [], expiresAt, optContext: context }
						}
					],
					beneficiaries: null
				},
				context: {
					openMiningRound: round.contract_id,
					issuingMiningRounds: [],
					validatorRights: [],
					featuredAppRight: null
				},
				expectedDso: rules.contract.payload.dso
			}
		}
	};
	return [command, disclosed];
}

/** Releases a lock whose time has come. */
export const releaseCommand = (locked: Holding): Command => ({
	ExerciseCommand: {
		templateId: locked.templateId,
		contractId: locked.contractId,
		choice: 'LockedAmulet_OwnerExpireLockV2',
		choiceArgument: {}
	}
});

// ---- The validator: transfer pre-approvals for parties it hosts ---------------------------

function requiredEnv(name: string, value: string | undefined): string {
	if (!value) throw error(500, `Environment variable ${name} is not set`);
	return value;
}

let validatorToken: { jwt: string; exp: number } | undefined;

/** The validator's own user: the only one its admin endpoints answer to. */
async function validatorJwt(): Promise<string> {
	if (validatorToken && validatorToken.exp > Date.now() + 30_000) return validatorToken.jwt;
	const config = (await (await fetch(requiredEnv('LEDGER_AUTH_URL', LEDGER_AUTH_URL))).json()) as {
		token_endpoint: string;
	};
	const body = new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: requiredEnv('VALIDATOR_AUTH_CLIENT_ID', VALIDATOR_AUTH_CLIENT_ID),
		client_secret: requiredEnv('VALIDATOR_AUTH_CLIENT_SECRET', VALIDATOR_AUTH_CLIENT_SECRET),
		scope: 'openid daml_ledger_api'
	});
	const r = (await (await fetch(config.token_endpoint, { method: 'POST', body })).json()) as {
		access_token?: string;
		expires_in?: number;
	};
	if (!r.access_token) throw new Error('The validator token request failed');
	validatorToken = { jwt: r.access_token, exp: Date.now() + (r.expires_in ?? 60) * 1000 };
	return r.access_token;
}

/**
 * Asks the validator to offer `party` a transfer pre-approval: the validator pays for it and
 * keeps it renewed, the party accepts it once, and from then on coin sent to it just lands.
 */
export async function proposeSetup(party: string): Promise<string> {
	const url = requiredEnv('VALIDATOR_API_URL', VALIDATOR_API_URL).replace(/\/$/, '');
	const r = await fetch(`${url}/v0/admin/external-party/setup-proposal`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${await validatorJwt()}`
		},
		body: JSON.stringify({ user_party_id: party })
	});
	if (!r.ok) throw new Error(`Setup proposal: ${r.status} ${(await r.text()).slice(0, 200)}`);
	return ((await r.json()) as { contract_id: string }).contract_id;
}

/** The setup proposal waiting for `party`, and whether it already has a pre-approval. */
export async function setupState(party: string) {
	const [proposals, approvals] = await Promise.all([
		activeContracts(party, [SETUP_PROPOSAL]),
		activeContracts(party, [PREAPPROVAL])
	]);
	return {
		proposal: proposals[0] ?? null,
		approved: approvals.length > 0
	};
}

/** Coin sent to `party` that waits for it to accept — the case without a pre-approval. */
export async function incoming(party: string) {
	const pending = await (await sdk()).token.transfer.pending(party);
	return pending.map((t) => ({
		contractId: t.contractId,
		amount: Number(t.interfaceViewValue.transfer.amount),
		from: t.interfaceViewValue.transfer.sender
	}));
}

export async function acceptCommand(
	transferInstructionCid: string
): Promise<[Command, DisclosedContract[]]> {
	const [command, disclosed] = await (
		await sdk()
	).token.transfer.accept({ transferInstructionCid, registryUrl: scanUrl() });
	return [command as Command, disclosed as DisclosedContract[]];
}

/** The provider's own coin: what the DAOs' fees end up as. */
export const providerHoldings = () => holdings(providerParty());
