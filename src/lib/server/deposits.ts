import * as splice from './splice';
import {
	activeContracts,
	providerParty,
	sdk,
	submitAsProvider,
	type Commands,
	type DisclosedContract
} from './participant';

/**
 * Coin that arrives at the provider. A DAO's balance, or a party's purse, is paid in by sending
 * Canton Coin to the provider's party from any wallet, with the account's memo. The provider
 * has a transfer pre-approval, so coin lands in one step; a wallet that does not see it sends
 * a transfer instruction instead, which is accepted here. What arrived with a memo is read off
 * the provider's own transactions, so the figure is the ledger's: a restart recomputes it.
 */

const AMULET = '#splice-amulet:Splice.Amulet:Amulet';
const AMULET_RULES = '#splice-amulet:Splice.AmuletRules:AmuletRules';
const PREAPPROVAL = '#splice-amulet:Splice.AmuletRules:TransferPreapproval';

/**
 * The memo a transfer carries to be credited to an account: `syncvotes:<dao id>` for a DAO,
 * `syncvotes:<key fingerprint>` for a party (the fingerprint is the second half of its id).
 */
export const memoFor = (account: string) =>
	`syncvotes:${account.startsWith('dao:') ? account.slice(4) : account.slice(6)}`;
const MEMO = /^syncvotes:(?:([0-9a-f-]{36})|(1220[0-9a-f]{64}))$/;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** How long before a pre-approval runs out a fresh one is made, as the docs advise. */
const RENEW_BEFORE = 20 * 24 * 3600 * 1000;

/**
 * The provider's transfer pre-approval, created when none stands and again when the standing
 * one has less than twenty days to run (it runs a year), paid by the provider itself.
 */
export async function ensurePreapproval(): Promise<void> {
	const standing = await activeContracts(providerParty(), [PREAPPROVAL]);
	const mine = standing.filter(
		(c) => (c.createArgument as { receiver?: string }).receiver === providerParty()
	);
	const latest = Math.max(
		0,
		...mine.map((c) =>
			new Date((c.createArgument as { expiresAt?: string }).expiresAt ?? 0).getTime()
		)
	);
	if (latest > Date.now() + RENEW_BEFORE) return;
	const [rules, round] = await Promise.all([splice.amuletRules(), splice.openRound()]);
	const inputs = await activeContracts(providerParty(), [AMULET]);
	if (inputs.length === 0) throw new Error('The provider holds no coin');
	const year = 365 * 24 * 3600 * 1000;
	await submitAsProvider(
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
						receiver: providerParty(),
						provider: providerParty(),
						expiresAt: new Date(Date.now() + year).toISOString(),
						expectedDso: rules.dso
					}
				}
			}
		],
		`preapprove-provider-${Date.now()}`,
		[rules, round]
	);
	console.log('The provider has a transfer pre-approval');
}

/** Transfers sent to the provider that wait to be accepted: taken in. */
export async function acceptIncoming(): Promise<number> {
	const token = (await sdk()).token;
	const pending = (await token.transfer.pending(providerParty())).filter(
		(p) =>
			(p.interfaceViewValue as { transfer?: { receiver?: string } }).transfer?.receiver ===
			providerParty()
	);
	let accepted = 0;
	for (const p of pending) {
		try {
			const [command, disclosed] = await token.transfer.accept({
				transferInstructionCid: p.contractId,
				registryUrl: splice.scanUrl()
			});
			await submitAsProvider(
				[command] as Commands,
				`accept-${p.contractId.slice(0, 16)}`,
				disclosed as DisclosedContract[]
			);
			accepted++;
		} catch (e) {
			console.warn(`Transfer to the provider not accepted:`, message(e));
		}
	}
	return accepted;
}

export type Deposit = {
	/** `dao:<id>` or `purse:<fingerprint>`. */
	account: `dao:${string}` | `purse:${string}`;
	amount: number;
	from: string;
	updateId: string;
	offset: number;
	recordTime: string;
};

/**
 * Coin that arrived at the provider in this window of offsets, carrying an account's memo: the
 * token standard's view of the provider's transactions, filtered to transfers in. Everything
 * else that lands (fees, rewards, unmarked coin) is the provider's own. The participant lists
 * at most two hundred transactions per call, so a window that holds more comes back as
 * `null` for the caller to split.
 */
export async function deposits(
	afterOffset: number,
	beforeOffset: number
): Promise<{ found: Deposit[]; oldest: string | null } | null> {
	let page;
	try {
		page = await (
			await sdk()
		).token.holdings({ partyId: providerParty(), afterOffset, beforeOffset });
	} catch (e) {
		const text = e instanceof Error ? e.message : JSON.stringify(e);
		if (/MAXIMUM_LIST_ELEMENTS/.test(text)) return null;
		throw e;
	}
	const found: Deposit[] = [];
	let oldest: string | null = null;
	for (const tx of page.transactions) {
		if (!oldest || tx.recordTime < oldest) oldest = tx.recordTime;
		for (const e of tx.events) {
			if (e.label.type !== 'TransferIn' && e.label.type !== 'MergeSplit') continue;
			const m = e.label.reason?.match(MEMO);
			if (!m) continue;
			const account = m[1] ? (`dao:${m[1]}` as const) : (`purse:${m[2]}` as const);
			let amount = 0;
			let from = '';
			if (e.label.type === 'TransferIn') {
				amount = Number(e.unlockedHoldingsChangeSummary?.amountChange ?? 0);
				from = e.label.sender;
			} else if (e.label.type === 'MergeSplit') {
				// The provider crediting an account from its own coin: a transfer to itself with
				// the memo, which the ledger records as a merge; the amount is in the choice.
				const t = (
					e.label.tokenStandardChoice?.choiceArgument as {
						transfer?: { sender?: string; receiver?: string; amount?: string };
					} | null
				)?.transfer;
				if (
					e.label.tokenStandardChoice?.name === 'TransferFactory_Transfer' &&
					t?.sender === providerParty() &&
					t?.receiver === providerParty()
				) {
					amount = Number(t.amount ?? 0);
					from = providerParty();
				}
			}
			if (amount > 0) {
				found.push({
					account,
					amount,
					from,
					updateId: tx.updateId,
					offset: tx.offset,
					recordTime: tx.recordTime
				});
			}
		}
	}
	return { found, oldest };
}
