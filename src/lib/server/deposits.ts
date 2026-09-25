import * as splice from './splice';
import {
	activeContracts,
	payeeParty,
	depositsSince,
	providerParty,
	receivingParties,
	sdk,
	submitAsProvider,
	type Commands,
	type DisclosedContract
} from './participant';

/**
 * Coin that arrives for the app. A DAO's balance, or a party's purse, is paid in by sending
 * Canton Coin to the payee (the validator's own party, whose wallet buys the traffic) from any
 * wallet, with the account's memo. The payee has a transfer pre-approval, so coin lands in one
 * step. What arrived with a memo is read off the payee's transactions, and off the provider's,
 * which took the payments before; so the figure is the ledger's, and a restart recomputes it.
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
	// A payee of its own (the validator's party) keeps its own pre-approval; the validator renews it.
	if (payeeParty() !== providerParty()) return;
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
	// Only the provider's are the app's to accept; a payee of its own has a pre-approval.
	if (payeeParty() !== providerParty()) return 0;
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

/** What the provider keeps of its own coin: enough for its fees and a pre-approval. */
const PROVIDER_FLOAT = 20;

/**
 * The provider's coin beyond its float, moved to the payee: its app rewards arrive at the
 * provider, while the payee's wallet is what buys the traffic they are paid for. The memo is
 * not an account's, so nothing is credited. Nothing moves where the provider is the payee.
 */
export async function sweepToPayee(): Promise<number> {
	if (payeeParty() === providerParty()) return 0;
	const coins = (await activeContracts(providerParty(), [AMULET])).filter(
		(c) => (c.createArgument as { owner?: string }).owner === providerParty()
	);
	const held = coins.reduce(
		(s, c) =>
			s +
			Number(
				(c.createArgument as { amount?: { initialAmount?: string } }).amount?.initialAmount ?? 0
			),
		0
	);
	const amount = Math.floor((held - PROVIDER_FLOAT) * 100) / 100;
	if (amount < 5) return 0;
	const token = (await sdk()).token;
	const [command, disclosed] = await token.transfer.create({
		sender: providerParty(),
		recipient: payeeParty(),
		amount: amount.toFixed(2),
		instrumentId: 'Amulet',
		registryUrl: splice.scanUrl(),
		memo: 'syncvotes provider rewards to the payee'
	});
	await submitAsProvider(
		[command] as Commands,
		`sweep-${Date.now()}`,
		disclosed as DisclosedContract[]
	);
	console.log(`Moved ${amount} CC of the provider's to the payee`);
	return amount;
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
 * Coin that arrived for the app in this window of offsets, carrying an account's memo: the
 * token standard's view of each receiving party's transactions, filtered to transfers in.
 * Everything else that lands (fees, rewards, unmarked coin) is that party's own. The
 * participant lists at most two hundred transactions per call, so a window that holds more
 * comes back as `null` for the caller to split.
 */
export async function deposits(
	afterOffset: number,
	beforeOffset: number
): Promise<{ found: Deposit[]; oldest: string | null } | null> {
	const found: Deposit[] = [];
	let oldest: string | null = null;
	for (const party of receivingParties()) {
		const window = await depositsOf(party, afterOffset, beforeOffset);
		if (!window) return null;
		found.push(...window.found);
		if (window.oldest && (!oldest || window.oldest < oldest)) oldest = window.oldest;
	}
	return { found, oldest };
}

async function depositsOf(
	party: string,
	afterOffset: number,
	beforeOffset: number
): Promise<{ found: Deposit[]; oldest: string | null } | null> {
	let page;
	try {
		page = await (await sdk()).token.holdings({ partyId: party, afterOffset, beforeOffset });
	} catch (e) {
		const text = e instanceof Error ? e.message : JSON.stringify(e);
		if (/MAXIMUM_LIST_ELEMENTS/.test(text)) return null;
		throw e;
	}
	const found: Deposit[] = [];
	let oldest: string | null = null;
	const since = depositsSince();
	for (const tx of page.transactions) {
		if (!oldest || tx.recordTime < oldest) oldest = tx.recordTime;
		if (since && tx.recordTime < since) continue;
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
				// A receiving party crediting an account from its own coin: a transfer to itself
				// with the memo, which the ledger records as a merge; the amount is in the choice.
				const t = (
					e.label.tokenStandardChoice?.choiceArgument as {
						transfer?: { sender?: string; receiver?: string; amount?: string };
					} | null
				)?.transfer;
				if (
					e.label.tokenStandardChoice?.name === 'TransferFactory_Transfer' &&
					t?.sender === party &&
					t?.receiver === party
				) {
					amount = Number(t.amount ?? 0);
					from = party;
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
