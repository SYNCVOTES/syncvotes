import { error } from '@sveltejs/kit';
import {
	activeContracts,
	api,
	ledgerError,
	providerParty,
	sdk,
	synchronizerId,
	userId,
	type Commands,
	type DisclosedContract
} from './participant';
import * as splice from './splice';

/**
 * A DAO's treasury: a party of its own on this participant, which the app acts for. Anyone
 * pays in by sending Canton Coin to it from any wallet; coin leaves it only as this app
 * moves it — for the DAO's own traffic, or for a payout a vote decided. The trust is the
 * same the DAO already places in the provider that counts its votes: the ledger records what
 * was decided and what was done, and the app is what does it.
 */

const AMULET = '#splice-amulet:Splice.Amulet:Amulet';
const LOCKED = '#splice-amulet:Splice.Amulet:LockedAmulet';
const AMULET_RULES = '#splice-amulet:Splice.AmuletRules:AmuletRules';

/** Submits as parties this app's user acts for: the provider, or a treasury. */
async function submitAs(
	actAs: string[],
	commands: Commands,
	commandId: string,
	disclosedContracts: DisclosedContract[] = []
): Promise<string> {
	try {
		const { updateId } = await (
			await sdk()
		).ledger.internal.submit({ commands, actAs, commandId, disclosedContracts });
		return updateId;
	} catch (e) {
		ledgerError(e);
	}
}

/**
 * A new treasury party for a DAO: allocated on this participant with the app's user given
 * the right to act for it. Allocation names the party by the DAO's id, so a party is never
 * mistaken for another DAO's.
 */
export async function allocate(daoId: string): Promise<string> {
	const me = await userId();
	const { partyDetails } = await api<{ partyDetails: { party: string } }>('/v2/parties', {
		partyIdHint: `dao-${daoId.slice(0, 8)}-${Date.now().toString(36)}`,
		identityProviderId: '',
		synchronizerId: await synchronizerId(),
		userId: me
	});
	const party = partyDetails.party;
	const rights = await api<{ rights: { kind: { CanActAs?: { value: { party: string } } } }[] }>(
		`/v2/users/${encodeURIComponent(me)}/rights`
	);
	if (!rights.rights.some((r) => r.kind.CanActAs?.value.party === party)) {
		await api(`/v2/users/${encodeURIComponent(me)}/rights`, {
			userId: me,
			identityProviderId: '',
			rights: [{ kind: { CanActAs: { value: { party } } } }]
		});
	}
	void preapprove(party).catch((e) =>
		console.warn(`Pre-approval for ${party.slice(0, 20)} not created:`, message(e))
	);
	return party;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * A transfer pre-approval, so coin sent to the treasury lands without anyone accepting it.
 * The provider pays for it. Wallets that do not see it yet send a transfer to accept, which
 * `acceptIncoming` takes care of.
 */
async function preapprove(treasury: string): Promise<void> {
	const [rules, round] = await Promise.all([splice.amuletRules(), splice.openRound()]);
	const inputs = await activeContracts(providerParty(), [AMULET]);
	if (inputs.length === 0) throw new Error('The provider holds no coin');
	const year = 365 * 24 * 3600 * 1000;
	// The choice takes both the receiver and the paying provider; the app acts for both.
	await submitAs(
		[treasury, providerParty()],
		[
			{
				ExerciseCommand: {
					templateId: AMULET_RULES,
					contractId: rules.contractId,
					choice: 'AmuletRules_CreateTransferPreapproval',
					choiceArgument: {
						context: {
							amuletRules: rules.contractId,
							context: {
								openMiningRound: round.contractId,
								issuingMiningRounds: [],
								validatorRights: [],
								featuredAppRight: null
							}
						},
						inputs: [{ tag: 'InputAmulet', value: inputs[0].contractId }],
						receiver: treasury,
						provider: providerParty(),
						expiresAt: new Date(Date.now() + year).toISOString(),
						expectedDso: rules.dso
					}
				}
			}
		],
		`preapprove-${treasury.split('::')[0]}`,
		[rules, round]
	);
}

// ---- Holdings ----------------------------------------------------------------------------

const holdingsCache = new Map<string, { at: number; promise: Promise<number> }>();
const HOLDINGS_TTL = 10_000;

/** The coin a treasury holds, unlocked; read from the participant, remembered for a moment. */
export function holdings(treasury: string, fresh = false): Promise<number> {
	const known = holdingsCache.get(treasury);
	if (!fresh && known && Date.now() - known.at < HOLDINGS_TTL) return known.promise;
	const promise = activeContracts(treasury, [AMULET]).then((found) =>
		found.reduce((sum, c) => {
			const amount = (c.createArgument as { amount?: { initialAmount?: string } }).amount;
			return sum + Number(amount?.initialAmount ?? 0);
		}, 0)
	);
	promise.catch(() => holdingsCache.delete(treasury));
	holdingsCache.set(treasury, { at: Date.now(), promise });
	return promise;
}

export const forget = (treasury: string) => {
	holdingsCache.delete(treasury);
	lockedCache.delete(treasury);
};

export type Locked = { contractId: string; amount: number; expiresAt: string };
const lockedCache = new Map<string, Locked[]>();

/** Coin the treasury sent that waits, locked, for its receiver: read with `refreshOutgoing`. */
export const lockedOf = (treasury: string): Locked[] => lockedCache.get(treasury) ?? [];

async function readLocked(treasury: string): Promise<Locked[]> {
	const found = await activeContracts(treasury, [LOCKED]);
	const locked = found.map((c) => {
		const a = c.createArgument as {
			amulet?: { amount?: { initialAmount?: string } };
			lock?: { expiresAt?: string };
		};
		return {
			contractId: c.contractId,
			amount: Number(a.amulet?.amount?.initialAmount ?? 0),
			expiresAt: a.lock?.expiresAt ?? ''
		};
	});
	lockedCache.set(treasury, locked);
	return locked;
}

/**
 * Locks that have run out — a payout nobody accepted in time — released back to the
 * treasury, as its owner. Resolves with what came back.
 */
export async function releaseExpired(treasury: string): Promise<Locked[]> {
	const expired = (await readLocked(treasury)).filter(
		(l) => l.expiresAt && new Date(l.expiresAt).getTime() < Date.now() - 60_000
	);
	const released: Locked[] = [];
	for (const l of expired) {
		try {
			await submitAs(
				[treasury],
				[
					{
						ExerciseCommand: {
							templateId: LOCKED,
							contractId: l.contractId,
							choice: 'LockedAmulet_OwnerExpireLockV2',
							choiceArgument: {}
						}
					}
				],
				`release-${l.contractId.slice(0, 16)}`
			);
			released.push(l);
		} catch (e) {
			console.warn(
				`Lock ${l.contractId.slice(0, 12)} of ${treasury.slice(0, 20)} not released:`,
				message(e)
			);
		}
	}
	if (released.length) forget(treasury);
	return released;
}

// ---- Moving coin -------------------------------------------------------------------------

/**
 * Coin out of the treasury, through the token standard: lands directly where the receiver
 * has a pre-approval, otherwise waits for the receiver to accept. Resolves with the
 * transaction's id.
 */
export async function transfer(
	treasury: string,
	to: string,
	amount: number,
	memo: string
): Promise<string> {
	if (amount <= 0) throw error(400, 'Nothing to transfer');
	const token = (await sdk()).token;
	const [command, disclosed] = await token.transfer.create({
		sender: treasury,
		recipient: to,
		amount: amount.toFixed(10),
		instrumentId: 'Amulet',
		registryUrl: splice.scanUrl(),
		memo
	});
	const updateId = await submitAs(
		[treasury],
		[command] as Commands,
		`transfer-${treasury.split('::')[0]}-${Date.now()}`,
		disclosed as DisclosedContract[]
	);
	forget(treasury);
	return updateId;
}

/**
 * Everything the treasury holds, to one party, as when a DAO dissolves. The sender pays the
 * network's fees out of the same coin, so the amount is what is left after them; a refused
 * attempt is retried a little lower.
 */
export async function transferAll(treasury: string, to: string, memo: string): Promise<string> {
	const held = await holdings(treasury, true);
	let amount = Math.floor((held - 0.05) * 0.99 * 10_000) / 10_000;
	let last: unknown;
	for (let i = 0; i < 4 && amount > 0; i++) {
		try {
			return await transfer(treasury, to, amount, memo);
		} catch (e) {
			last = e;
			amount = Math.floor(amount * 0.98 * 10_000) / 10_000;
		}
	}
	throw last ?? error(400, 'The treasury holds nothing to move');
}

type Instruction = { receiver: string; sender: string; amount: number };
const view = (p: { interfaceViewValue: { transfer?: unknown } }): Instruction => {
	const t = (p.interfaceViewValue.transfer ?? {}) as {
		receiver?: string;
		sender?: string;
		amount?: string;
	};
	return { receiver: t.receiver ?? '', sender: t.sender ?? '', amount: Number(t.amount ?? 0) };
};

/** Transfers the treasury sent that still wait for their receiver; read with `refreshOutgoing`. */
const outgoingCache = new Map<string, Instruction[]>();
export const outgoing = (treasury: string): Instruction[] => outgoingCache.get(treasury) ?? [];

/** Reads what the treasury sent and still waits for, and what of it sits locked. */
export async function refreshOutgoing(treasury: string): Promise<void> {
	const token = (await sdk()).token;
	const all = (await token.transfer.pending(treasury)).map(view);
	outgoingCache.set(
		treasury,
		all.filter((p) => p.sender === treasury && p.receiver !== treasury)
	);
	await readLocked(treasury);
}

/**
 * Coin sent to the treasury that waits for its acceptance: accepted, as the treasury. What
 * the treasury itself sent and still waits for is remembered for the pages. Resolves with the
 * transactions of the acceptances, for the DAO to be charged.
 */
export async function acceptIncoming(treasury: string): Promise<string[]> {
	const token = (await sdk()).token;
	const all = (await token.transfer.pending(treasury)).map((p) => ({
		cid: p.contractId,
		...view(p)
	}));
	outgoingCache.set(
		treasury,
		all.filter((p) => p.sender === treasury && p.receiver !== treasury)
	);
	const pending = all.filter((p) => p.receiver === treasury);
	const accepted: string[] = [];
	for (const p of pending) {
		try {
			const [command, disclosed] = await token.transfer.accept({
				transferInstructionCid: p.cid,
				registryUrl: splice.scanUrl()
			});
			accepted.push(
				await submitAs(
					[treasury],
					[command] as Commands,
					`accept-${p.cid.slice(0, 16)}`,
					disclosed as DisclosedContract[]
				)
			);
		} catch (e) {
			console.warn(`Transfer to ${treasury.slice(0, 20)} not accepted:`, message(e));
		}
	}
	if (accepted.length) forget(treasury);
	return accepted;
}
