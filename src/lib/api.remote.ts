import { error } from '@sveltejs/kit';
import { ed25519 } from '@noble/curves/ed25519.js';
import { command, form, query, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { Main } from '@daml.js/model';
import * as participant from './server/participant';
import * as ledger from './server/ledger';
import * as session from './server/session';
import * as billing from './server/billing';
import * as splice from './server/splice';
import * as tally from './server/tally';
import { fingerprintOf } from './verify';
import { INVITE_CODES } from '$app/env/private';
import { normaliseHint, hintProblem } from './hint';
import * as schemas from './schemas';
import { categoryOf, settingsOf, settingsToLedger } from './rules';

/**
 * The server's API as remote functions: pages call these like local functions and SvelteKit
 * does the transport. Reads come from the in-memory ledger copy and are live — each sends its
 * value, then sends it again whenever what it shows changed — and need a read session (a
 * challenge signed by the party's key, `server/session.ts`) plus membership. Writes are
 * prepared here, signed in the browser and executed here; the ledger accepts them only with the
 * acting party's own signature. A DAO's writes are refused once its balance is spent.
 */

/**
 * Runs `load` now and whenever `key` changes, yielding only when the result changed. `keys`
 * names further keys to wake on, chosen afresh each round (the DAOs a party is in, say).
 */
async function* live<T>(
	key: string,
	load: () => T | Promise<T>,
	keys: () => string[] = () => []
): AsyncGenerator<T> {
	let last = '';
	for (;;) {
		try {
			const value = await load();
			const serialised = JSON.stringify(value);
			if (serialised !== last) {
				last = serialised;
				yield value;
			}
		} catch (e) {
			// Access gone (401/403/404) ends the stream with that error, so a page never keeps
			// showing a snapshot of something it may no longer see.
			const status = (e as { status?: number }).status;
			if (last === '' || status === 401 || status === 403 || status === 404) throw e;
			console.warn(`Live ${key} kept its last value:`, e instanceof Error ? e.message : e);
		}
		await ledger.nextChange(key, ...keys());
	}
}

const base64 = v.pipe(v.string(), v.nonEmpty(), v.base64());
const partyId = schemas.partyId;
const contractId = v.pipe(v.string(), v.nonEmpty());
/** A page of a list: up to a thousand at once, so "show all" reaches a whole DAO. */
const paging = {
	offset: v.pipe(v.number(), v.integer(), v.minValue(0)),
	limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1000))
};
const filter = v.optional(v.pipe(v.string(), v.maxLength(100)), '');

type Page<T> = { items: T[]; total: number; offset: number };
const page = <T>(all: T[], offset: number, limit: number): Page<T> => ({
	items: all.slice(offset, offset + limit),
	total: all.length,
	offset
});

/** A party as the pages show it: with the name and picture it gave itself, if any. */
export type Who = { party: string; name: string | null; avatar: string | null };
const who = (party: string): Who => {
	const profile = ledger.profiles.get(party);
	return { party, name: profile?.name ?? null, avatar: profile?.avatar ?? null };
};
const matches = (needle: string) => (party: string) => {
	const q = needle.trim().toLowerCase();
	if (!q) return true;
	return (
		party.toLowerCase().includes(q) ||
		(ledger.profiles.get(party)?.name.toLowerCase().includes(q) ?? false)
	);
};

/** The parties and prices the browser shows and checks against. Public, nothing secret. */
export const config = query(async () => ({
	provider: participant.providerParty(),
	operator: participant.operatorParty(),
	prices: await splice.prices(),
	batch: schemas.BATCH,
	maxChanges: schemas.MAX_CHANGES,
	/** A new party needs an invite code while any are set. */
	invitesRequired: inviteCodes().length > 0
}));

// ---- Invites -------------------------------------------------------------------------------

/** The codes that open sign-up, from the environment; none set means open to all. */
const inviteCodes = () =>
	(INVITE_CODES ?? '')
		.split(',')
		.map((c) => c.trim())
		.filter(Boolean);
const inviteOk = (code: string) => {
	const codes = inviteCodes();
	return codes.length === 0 || codes.includes(code.trim());
};
/** Whether this code opens sign-up; asked before anyone pays for a party. */
export const checkInvite = query(v.optional(v.string(), ''), (code) => inviteOk(code));

// ---- Identity ----------------------------------------------------------------------------

const accountOf = (party: string): ledger.Account => {
	const account = ledger.accounts.get(party);
	if (!account) error(404, 'This party is not registered with the app');
	return account;
};

/** The party's Account, created by the provider if it has none: its door to the app. */
async function ensureAccount(
	party: string
): Promise<{ account: ledger.Account; updateId: string | null }> {
	const known = ledger.accounts.get(party);
	if (known) return { account: known, updateId: null };
	const updateId = await participant.submitAsProvider(
		[
			{
				CreateCommand: {
					templateId: Main.Account.templateId,
					createArguments: {
						provider: participant.providerParty(),
						operator: participant.operatorParty(),
						user: party
					}
				}
			}
		],
		`register-${party.split('::')[1]}-${Date.now()}`
	);
	await ledger.applied(updateId);
	return { account: accountOf(party), updateId };
}

/**
 * Who is this key? A party's namespace is the fingerprint of its key, so a registered party is
 * found by that alone. A party the participant hosts that has no Account here — made under an
 * earlier package of this app — gets one again, and is back with everything that survived. A
 * key nobody has seen gets to choose the hint its party id will carry.
 */
export const lookup = query(base64, async (publicKey) => {
	paceLookups();
	const fingerprint = await fingerprintOf(new Uint8Array(Buffer.from(publicKey, 'base64')));
	for (const account of ledger.accounts.values()) {
		if (account.party.split('::')[1] === fingerprint) {
			return { exists: true as const, party: account.party, account: account.contractId };
		}
	}
	const hosted = await participant.partyByFingerprint(fingerprint);
	if (hosted) {
		const { account } = await ensureAccount(hosted);
		return { exists: true as const, party: hosted, account: account.contractId };
	}
	return { exists: false as const, fingerprint };
});

const hintOf = (hint: string) => {
	const chosen = normaliseHint(hint);
	const problem = hintProblem(chosen);
	if (problem) error(400, problem);
	return chosen;
};

/** The party this key would be under this hint, and what the key has to sign to create it. */
export const topology = query(
	v.object({ publicKey: base64, hint: v.string() }),
	({ publicKey, hint }) => participant.partyTopology(hintOf(hint), publicKey)
);

/**
 * The key signed its topology: create the party, then its Account — once what arrived for
 * the key covers what that costs, so nothing is spent for a party before its owner has paid.
 * The allocation is charged to the party's purse, opened here.
 */
export const enrol = command(
	v.object({
		publicKey: base64,
		hint: v.string(),
		multiHash: base64,
		signature: base64,
		invite: v.optional(v.string(), '')
	}),
	async ({ publicKey, hint, multiHash, signature, invite }) => {
		if (!inviteOk(invite))
			error(403, 'This app is by invitation for now; the code is missing or wrong');
		// The ledger verifies this signature when it allocates a new party; for a party that
		// already exists it never looks, so check here too.
		const valid = ed25519.verify(
			Buffer.from(signature, 'base64'),
			Buffer.from(multiHash, 'base64'),
			Buffer.from(publicKey, 'base64')
		);
		if (!valid) error(403, 'The signature does not match the key');
		const fingerprint = await fingerprintOf(new Uint8Array(Buffer.from(publicKey, 'base64')));
		const topology = await participant.partyTopology(hintOf(hint), publicKey);
		const bytes = participant.topologyBytes(topology);
		const needed = await billing.enrolCost(bytes);
		const have = billing.credit(fingerprint);
		if (have < needed) {
			error(
				402,
				`A party costs ${needed.toFixed(2)} CC today; ${have.toFixed(2)} CC has arrived for this key`
			);
		}
		const count = pacedEnrol();
		const { partyId: party } = await participant.allocateParty(
			hintOf(hint),
			publicKey,
			multiHash,
			signature
		);
		const { updateId } = await ensureAccount(party);
		await billing.openPurse(fingerprint, party, bytes, updateId);
		count();
		return { party, account: accountOf(party).contractId };
	}
);

// ---- Read session ------------------------------------------------------------------------

/** Step one: bytes for the key to sign. */
export const sessionChallenge = command(
	v.object({ party: partyId, publicKey: base64 }),
	({ party, publicKey }) => session.challenge(party, publicKey)
);

/** Step two: the signature comes back; the reply sets the session cookie. */
export const sessionStart = command(
	v.object({ nonce: base64, signature: base64 }),
	({ nonce, signature }) => session.start(nonce, signature)
);

export const sessionEnd = command(() => session.end());

// ---- Reads -------------------------------------------------------------------------------

/** Counts for the landing ticker. Aggregates only — DAOs are private, their contents stay so. */
export const stats = query.live(() =>
	live(ledger.keys.all, () => {
		let votes = 0;
		for (const b of ledger.ballots.values()) votes += b.size;
		let open = 0;
		for (const p of ledger.proposals.values()) if (!p.outcome) open++;
		let publicDaos = 0;
		for (const d of ledger.daos.values()) if (d.public) publicDaos++;
		return {
			daos: ledger.daos.size,
			publicDaos,
			openProposals: open,
			votesCast: votes,
			members: ledger.accounts.size
		};
	})
);

const daoOf = (id: string): ledger.Dao => {
	const dao = ledger.daos.get(id);
	if (!dao) error(404, 'No such DAO');
	return dao;
};
const membersOf = (daoId: string) => [...(ledger.members.get(daoId)?.values() ?? [])];
const proposalsOf = (daoId: string) =>
	[...(ledger.proposalsOf.get(daoId)?.values() ?? [])].sort((a, b) =>
		b.createdAt.localeCompare(a.createdAt)
	);
const openProposals = (daoId: string) => proposalsOf(daoId).filter((p) => !p.outcome).length;
/**
 * Whether a proposal still waits on this party's vote: open and not past its deadline, the party
 * a member entitled to vote on it (in, with that share, when it was made), and no ballot cast.
 */
const awaitsVote = (p: ledger.Proposal, party: string) => {
	if (p.outcome || ledger.time(p.closesAt) <= Date.now()) return false;
	const m = ledger.members.get(p.daoId)?.get(party);
	return (
		!!m &&
		ledger.eligible(p, { since: m.since, shareSince: m.shareSince, castAt: p.createdAt }) &&
		!ledger.ballots.get(p.id)?.has(party)
	);
};
const awaiting = (daoId: string, party: string) =>
	proposalsOf(daoId).filter((p) => awaitsVote(p, party)).length;
/** The caller's membership of this DAO, or 403. */
const memberOnly = (daoId: string): ledger.Member => {
	const membership = ledger.members.get(daoId)?.get(session.required());
	if (!membership) error(403, 'Only members can see this DAO');
	return membership;
};
/** The caller's membership, or null for a signed-in reader of a public DAO; 403 otherwise. */
const readerOf = (daoId: string): ledger.Member | null => {
	const me = session.required();
	const membership = ledger.members.get(daoId)?.get(me) ?? null;
	if (!membership && !ledger.daos.get(daoId)?.public) error(403, 'Only members can see this DAO');
	return membership;
};

const summarise = (d: ledger.Dao) => ({
	...d,
	members: ledger.members.get(d.id)?.size ?? 0,
	proposals: proposalsOf(d.id).length,
	openProposals: openProposals(d.id)
});
/** A DAO as its card shows it: with what it can spend and the caller's share of its vote. */
const card = async (d: ledger.Dao, party: string) => ({
	...summarise(d),
	balance: billing.balance(billing.daoAccount(d.id)),
	myShare: ledger.members.get(d.id)?.get(party)?.share ?? 0,
	/** Open proposals this party is entitled to vote on and has not. */
	awaiting: awaiting(d.id, party)
});

/** The DAOs a party belongs to, newest first. */
export const myDaos = query.live(partyId, (party) =>
	live(
		ledger.keys.party(party),
		() => {
			session.required(party);
			return Promise.all(
				[...(ledger.memberships.get(party)?.keys() ?? [])]
					.flatMap((id) => ledger.daos.get(id) ?? [])
					.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
					.map((d) => card(d, party))
			);
		},
		// A proposal made in one of them changes what waits on this party's vote.
		() => [...(ledger.memberships.get(party)?.keys() ?? [])].map(ledger.keys.dao)
	)
);

/** A DAO with its counts and the caller's standing in it. The lists are paged separately. */
export const dao = query.live(contractId, (id) =>
	live(ledger.keys.dao(id), async () => {
		const membership = readerOf(id);
		const d = daoOf(id);
		return {
			...summarise(d),
			balance: billing.balance(billing.daoAccount(id)),
			// A founding table still being carried out: the DAO is not whole yet.
			founding:
				!!ledger.proposals.get(`${id}-founding`) &&
				!ledger.proposals.get(`${id}-founding`)?.executedAt,
			me: {
				creator: d.creator === session.required(),
				/** Null for a reader of a public DAO who is not in it. */
				membership: membership?.contractId ?? null,
				share: membership?.share ?? 0
			}
		};
	})
);

/** Public DAOs, for anyone signed in: by name, description or id, biggest first or newest. */
export const publicDaos = query.live(
	v.object({
		...paging,
		q: filter,
		sort: v.optional(v.picklist(['members', 'newest']), 'members')
	}),
	({ offset, limit, q, sort }) =>
		live(ledger.keys.all, () => {
			session.required();
			const needle = q.trim().toLowerCase();
			const all = [...ledger.daos.values()]
				.filter(
					(d) =>
						d.public &&
						(!needle ||
							d.name.toLowerCase().includes(needle) ||
							d.description.toLowerCase().includes(needle) ||
							d.id.startsWith(needle))
				)
				.map(summarise)
				.sort((a, b) =>
					sort === 'newest'
						? b.createdAt.localeCompare(a.createdAt)
						: b.members - a.members || b.createdAt.localeCompare(a.createdAt)
				);
			return page(all, offset, limit);
		})
);

/** Members, by name or party id, filtered by a substring of either; biggest share first. */
export const daoMembers = query.live(
	v.object({ id: contractId, ...paging, q: filter }),
	({ id, offset, limit, q }) =>
		live(ledger.keys.dao(id), () => {
			readerOf(id);
			const all = membersOf(id)
				.filter((m) => matches(q)(m.party))
				.sort((a, b) => b.share - a.share || a.party.localeCompare(b.party))
				.map((m) => ({ ...m, who: who(m.party) }));
			return page(all, offset, limit);
		})
);

/** The whole share table, for the editor: every member with their units. */
export const daoShares = query.live(contractId, (id) =>
	live(ledger.keys.dao(id), () => {
		memberOnly(id);
		return membersOf(id)
			.sort((a, b) => b.share - a.share || a.party.localeCompare(b.party))
			.map((m) => ({ party: m.party, share: m.share, who: who(m.party) }));
	})
);

/** Proposals, newest first, by status, filtered by a substring of the title or the proposer. */
export const daoProposals = query.live(
	v.object({
		id: contractId,
		...paging,
		/** `unvoted`: open, and still waiting on the caller's own vote. */
		status: v.optional(v.picklist(['open', 'closed', 'unvoted'])),
		q: filter
	}),
	({ id, offset, limit, status, q }) =>
		live(ledger.keys.dao(id), () => {
			readerOf(id);
			const party = session.required();
			const needle = q.trim().toLowerCase();
			const all = proposalsOf(id).filter(
				(p) =>
					(status === 'open'
						? !p.outcome
						: status === 'closed'
							? !!p.outcome
							: status === 'unvoted'
								? awaitsVote(p, party)
								: true) &&
					(!needle || p.title.toLowerCase().includes(needle) || matches(q)(p.proposer))
			);
			return page(all, offset, limit);
		})
);

export type PartyCheck = 'addable' | 'already' | 'unknown';

/**
 * Whether each of these party ids can be added: registered and not a member yet. Without a
 * DAO (while one is being created) it only asks whether the party is registered.
 */
export const checkParties = query(
	v.object({
		dao: v.optional(contractId),
		parties: v.pipe(v.array(partyId), v.maxLength(schemas.MAX_CHANGES))
	}),
	({ dao, parties }): Record<string, PartyCheck> => {
		if (dao) memberOnly(dao);
		else session.required();
		const check = (p: string): PartyCheck =>
			dao && ledger.members.get(dao)?.has(p)
				? 'already'
				: ledger.accounts.has(p)
					? 'addable'
					: 'unknown';
		return Object.fromEntries(parties.map((p) => [p, check(p)]));
	}
);

const proposalOf = (id: string): ledger.Proposal => {
	const p = ledger.proposals.get(id);
	if (!p) error(404, 'No such proposal');
	return p;
};

/**
 * The caller's membership of the proposal's DAO, or null for a proposer who left or a reader
 * of a public DAO; 403 otherwise.
 */
const proposalReader = (p: ledger.Proposal): ledger.Member | null => {
	const me = session.required();
	const membership = ledger.members.get(p.daoId)?.get(me);
	if (!membership && p.proposer !== me && !ledger.daos.get(p.daoId)?.public) {
		error(403, 'Only members can see this proposal');
	}
	return membership ?? null;
};

/** Signing takes a moment; a ballot prepared this close to the deadline could land after it. */
const SIGNING_MARGIN = 90_000;
/** Whether this member may cast a ballot now: none cast, or one that may still be replaced. */
const mayVote = (p: ledger.Proposal, m: ledger.Member | null) => {
	if (!m || p.outcome) return false;
	if (ledger.time(p.closesAt) - Date.now() < SIGNING_MARGIN) return false;
	const now = new Date().toISOString();
	if (!ledger.eligible(p, { since: m.since, shareSince: m.shareSince, castAt: now })) return false;
	const mine = ledger.ballots.get(p.id)?.get(m.party);
	return !mine || (p.rule.changeable && !mine.counted);
};

/** Ballots that would count, summed by vote: the live tally where the ledger counts last. */
const summed = (p: ledger.Proposal) => {
	const options = p.effect.kind === 'choose' ? p.effect.options.length : 0;
	const sum = { yes: 0, no: 0, abstain: 0, tallies: Array<number>(options).fill(0), picked: 0 };
	for (const b of ledger.ballots.get(p.id)?.values() ?? []) {
		if (b.daoId !== p.daoId || b.changeable !== p.rule.changeable || !ledger.eligible(p, b))
			continue;
		const picks = ledger.picksOf(b.vote);
		if (picks.length > 0) {
			for (const pick of picks) if (pick < options) sum.tallies[pick] += b.weight;
			sum.picked += b.weight;
		} else if (b.vote === 'Abstain') sum.abstain += b.weight;
		else if (options > 0)
			continue; // a yes or no on a choice: the count refuses it
		else if (b.vote === 'Yes') sum.yes += b.weight;
		else sum.no += b.weight;
	}
	return sum;
};

/** A vote as the ledger takes it: a variant, since some constructors carry the options picked. */
const voteWire = (vote: ledger.Vote) => {
	const picks = ledger.picksOf(vote);
	return picks.length === 0
		? { tag: vote, value: {} }
		: vote.startsWith('PickMany:')
			? { tag: 'PickMany', value: picks.map(String) }
			: { tag: 'Pick', value: String(picks[0]) };
};

/** A proposal with its tally and the caller's standing: a ballot cast, a vote to cast, or neither. */
export const proposal = query.live(contractId, (id) =>
	live(ledger.keys.proposal(id), () => {
		const p = proposalOf(id);
		const me = proposalReader(p);
		const dao = ledger.daos.get(p.daoId);
		const mine = me && ledger.ballots.get(id)?.get(me.party);
		// Until the ledger has counted, the page shows what has been cast.
		const counted = p.yes + p.no + p.abstain + p.tallies.reduce((s, t) => s + t, 0);
		const shown =
			counted > 0 && !p.rule.changeable
				? {
						yes: p.yes,
						no: p.no,
						abstain: p.abstain,
						tallies: p.tallies,
						picked: p.picked ?? p.tallies.reduce((s, t) => s + t, 0)
					}
				: summed(p);
		return {
			...p,
			...shown,
			counted,
			daoName: dao?.name ?? null,
			daoEqual: dao?.equal ?? false,
			daoActorPays: dao?.actorPays ?? false,
			members: ledger.members.get(p.daoId)?.size ?? 0,
			cast: ledger.ballots.get(id)?.size ?? 0,
			comments: ledger.comments.get(id)?.size ?? 0,
			proposedBy: who(p.proposer),
			waiting: tally.waiting.get(id) ?? null,
			/** Why the provider could not carry it out, after repeated attempts. */
			stuck: tally.stuck.get(id) ?? null,
			me: {
				party: me?.party ?? session.required(),
				membership: me?.contractId ?? null,
				vote: mine?.vote ?? null,
				ballot: mine?.contractId ?? null,
				weight: mine?.weight ?? me?.share ?? null,
				mayVote: mayVote(p, me),
				reshared: !!me && ledger.time(me.shareSince) > ledger.time(p.createdAt)
			}
		};
	})
);

/** Ballots, newest first, filtered by a substring of the voter's party id or name. */
export const proposalBallots = query.live(
	v.object({ id: contractId, ...paging, q: filter }),
	({ id, offset, limit, q }) =>
		live(ledger.keys.proposal(id), () => {
			const p = proposalOf(id);
			// Who voted how is the members' business, public DAO or not.
			if (!proposalReader(p) && p.proposer !== session.required()) {
				error(403, 'Only members see the ballots');
			}
			// A secret ballot: nobody is shown anyone's vote but their own.
			const me = session.required();
			const all = [...(ledger.ballots.get(id)?.values() ?? [])]
				.filter((b) => b.daoId === p.daoId && matches(q)(b.voter) && (!p.secret || b.voter === me))
				.sort((a, b) => b.castAt.localeCompare(a.castAt))
				.map((b) => ({ ...b, who: who(b.voter) }));
			return page(all, offset, limit);
		})
);

/** The last `limit` comments, oldest first, with who wrote them; earlier ones on request. */
export const proposalComments = query.live(
	v.object({ id: contractId, limit: paging.limit }),
	({ id, limit }) =>
		live(ledger.keys.proposal(id), () => {
			const p = proposalOf(id);
			const me = proposalReader(p);
			const all = [...(ledger.comments.get(id)?.values() ?? [])]
				.filter((c) => c.daoId === p.daoId)
				.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
			return {
				total: all.length,
				items: all
					.slice(Math.max(0, all.length - limit))
					.map((c) => ({ ...c, who: who(c.author), mine: c.author === (me?.party ?? p.proposer) }))
			};
		})
);

/** The DAO's account: paid in, charged, what a byte costs it, and where to pay in. */
export const daoBilling = query.live(contractId, (id) =>
	live(ledger.keys.dao(id), () => {
		readerOf(id);
		return billing.statement(billing.daoAccount(id));
	})
);

/**
 * A key's own account, before and after its party exists: what arrived for it, what a party
 * costs today, and where to pay. Open to anyone with a fingerprint, since a key without a
 * party has no session to show.
 */
export const purse = query.live(v.pipe(v.string(), v.regex(/^1220[0-9a-f]{64}$/)), (fingerprint) =>
	live(ledger.keys.purse(fingerprint), async () => ({
		...(await billing.statement(billing.purseAccount(fingerprint))),
		needed: await billing.enrolCost(),
		allocated: ledger.purses.get(fingerprint)?.party ?? null
	}))
);

/** The signed-in party's own account. */
export const myPurse = query.live(partyId, (party) =>
	live(ledger.keys.purse(party.split('::')[1] ?? ''), () => {
		session.required(party);
		return billing.statement(billing.purseOfParty(party));
	})
);

/** A party's profile, as anyone signed in may see it. */
export const profile = query.live(partyId, (party) =>
	live(ledger.keys.party(party), () => {
		session.required();
		const p = ledger.profiles.get(party);
		return p ? { ...p, exists: true as const } : { party, exists: false as const };
	})
);

// ---- Writes: prepared here, signed in the browser, executed here --------------------------

/**
 * Every write names its subject by id and is prepared on the current contract; the browser
 * signs only if that is the contract it is looking at (`verify.ts`), so a change that landed
 * in between is caught before anything is signed. A DAO's writes need its balance.
 */
/** Who pays a party's transaction: the DAO it is in, unless the DAO has each member pay, or there is none. */
const payerFor = (party: string, dao: string | null): billing.Account =>
	dao && !ledger.daos.get(dao)?.actorPays ? billing.daoAccount(dao) : billing.purseOfParty(party);

const prepare = async (
	party: string,
	template: { templateId: string },
	contractId: string,
	choice: string,
	choiceArgument: unknown,
	dao: string | null
) => {
	const payer = payerFor(party, dao);
	await billing.funded(payer);
	const prepared = await participant.prepare(
		party,
		[{ ExerciseCommand: { templateId: template.templateId, contractId, choice, choiceArgument } }],
		{ payer }
	);
	// The participant has priced it: what the account holds has to cover that.
	await billing.funded(payer, prepared.cost);
	return prepared;
};

const nullable = (s: string) => (s === '' ? null : s);

/**
 * The text forms: each field is checked against the shared schema — in the browser before
 * submitting, so issues show under the field, and here again — then the transaction is
 * prepared. The browser verifies it says what the form said, signs it and executes it.
 */
export const createDaoForm = form(schemas.createDaoForm, async (f) => {
	const { daoName, description, image, equal, actorPays, shares } = f;
	const isPublic = f.public === 'yes';
	const party = session.required();
	const account = accountOf(party).contractId;
	if (!shares.some((r) => r.party === party)) error(400, 'You have to hold a share yourself');
	for (const r of shares) {
		if (!ledger.accounts.has(r.party)) error(404, `${r.party} is not registered with the app`);
	}
	const id = crypto.randomUUID();
	// The creator's own share is in the first batch, so the DAO is theirs from the start.
	const ordered = [
		...shares.filter((r) => r.party === party),
		...shares.filter((r) => r.party !== party)
	];
	const args = {
		id,
		daoName,
		description,
		image: nullable(image),
		equal: equal === 'yes',
		routine: settingsToLedger(settingsOf(f, 'routine')),
		sensitive: settingsToLedger(settingsOf(f, 'sensitive')),
		shares: schemas.shareTuples(ordered.slice(0, schemas.BATCH)),
		more: schemas.shareTuples(ordered.slice(schemas.BATCH)),
		actorPays: actorPays === 'yes',
		public: isPublic
	};
	return {
		id,
		args,
		prepared: await prepare(party, Main.Account, account, 'Account_CreateDAO', args, null)
	};
});

export const createProposalForm = form(schemas.createProposalForm, async (f) => {
	const party = session.required();
	paced(party);
	const membership = memberOnly(f.dao).contractId;
	const d = daoOf(f.dao);
	const pid = crypto.randomUUID();
	let action: { tag: string; value: unknown };
	switch (f.kind) {
		case 'info':
			action = {
				tag: 'SetInfo',
				value: {
					daoName: f.newName.trim(),
					description: f.newDescription,
					image: nullable(f.newImage)
				}
			};
			break;
		case 'choose': {
			const options = schemas.parseOptions(f.options);
			if (!schemas.validOptions(options)) error(400, 'Two to ten distinct options');
			action = { tag: 'Choose', value: { options, several: f.several === 'yes' ? true : null } };
			break;
		}
		case 'visibility':
			action = { tag: 'SetPublic', value: { public: f.newPublic === 'yes' } };
			break;
		case 'dissolve':
			action = { tag: 'Dissolve', value: {} };
			break;
		case 'settings':
			action = {
				tag: 'SetSettings',
				value: {
					routine: settingsToLedger(settingsOf(f, 'newRoutine')),
					sensitive: settingsToLedger(settingsOf(f, 'newSensitive'))
				}
			};
			break;
		case 'shares': {
			const rows = v.parse(schemas.shareChanges, f.shares);
			const members = ledger.members.get(f.dao);
			for (const r of rows) {
				if (!ledger.accounts.has(r.party)) error(404, `${r.party} is not registered with the app`);
				if (d.equal && r.share > 1) error(400, 'By membership, a member holds one unit');
				if (r.share === 0 && !members?.has(r.party)) error(400, `${r.party} is not a member`);
			}
			// Two open changes naming the same party would each be applied whole; one at a time.
			const touched = new Set(rows.map((r) => r.party));
			for (const o of ledger.proposalsOf.get(f.dao)?.values() ?? []) {
				if (o.outcome === 'Failed' || o.executedAt) continue;
				if (o.effect.kind !== 'shares') continue;
				const clash = o.effect.changes.find((c) => touched.has(c.party));
				if (clash) {
					error(
						409,
						`“${o.title}” already changes ${clash.party.split('::')[0]}; wait until it is settled and carried out`
					);
				}
			}
			// A change that leaves nobody, or no units, is refused before it is signed.
			let units = d.units;
			let count = d.members;
			for (const r of rows) {
				const had = members?.get(r.party)?.share ?? 0;
				units += r.share - had;
				if (had === 0 && r.share > 0) count++;
				if (had > 0 && r.share === 0) count--;
			}
			if (count <= 0 || units <= 0) error(400, 'A DAO keeps at least one member with a share');
			action = { tag: 'SetShares', value: { changes: schemas.shareTuples(rows) } };
			break;
		}
		default:
			action = { tag: 'Signal', value: {} };
	}
	// A decision or a choice runs under the rule its proposer set; the rest under the DAO's.
	const own =
		categoryOf(f.kind) === 'routine' ? settingsToLedger(settingsOf(f, 'newRoutine')) : null;
	const args = {
		dao: d.contractId,
		pid,
		title: f.title,
		description: f.description,
		action,
		// Secrecy travels in the rule, the proposer's or the DAO's.
		secret: null,
		rule: own?.rule ?? null,
		votingDays: own?.votingDays ?? null
	};
	return {
		pid,
		membership,
		args,
		prepared: await prepare(party, Main.Member, membership, 'Member_Propose', args, f.dao)
	};
});

/** A ballot, cast from the voter's own membership contract; a replaced one is handed in. */
export const prepareVote = command(
	v.object({
		proposal: contractId,
		vote: v.union([
			v.picklist(['Yes', 'No', 'Abstain']),
			v.pipe(v.string(), v.regex(/^Pick:\d$/)),
			v.pipe(v.string(), v.regex(/^PickMany:\d(,\d){0,9}$/))
		])
	}),
	({ proposal, vote }) => {
		const p = proposalOf(proposal);
		const me = proposalReader(p);
		if (!me || !mayVote(p, me)) error(409, 'You have no vote on this proposal');
		const picks = ledger.picksOf(vote);
		if (p.effect.kind === 'choose') {
			const { options, several } = p.effect;
			if (picks.length === 0 && vote !== 'Abstain')
				error(400, 'This proposal is a choice among options');
			if (picks.some((pick) => pick >= options.length)) error(400, 'No such option');
			if (vote.startsWith('PickMany:')) {
				if (!several) error(400, 'This proposal takes one option');
				if (new Set(picks).size !== picks.length) error(400, 'An option picked twice');
			}
		} else if (picks.length > 0) error(400, 'This proposal takes yes or no');
		const previous = ledger.ballots.get(proposal)?.get(me.party)?.contractId ?? null;
		const args = {
			proposalId: proposal,
			closesAt: p.closesAt,
			changeable: p.rule.changeable,
			vote: voteWire(vote as ledger.Vote),
			previous
		};
		return prepare(me.party, Main.Member, me.contractId, 'Member_Vote', args, p.daoId);
	}
);

/** Keys looked up lately from one address: each unknown key has the participant's parties searched. */
const recentLookups = new Map<string, number[]>();
const LOOKUPS_PER_HOUR = 300;
function paceLookups() {
	const address = clientAddress();
	const now = Date.now();
	const mine = (recentLookups.get(address) ?? []).filter((t) => now - t < 3_600_000);
	if (mine.length >= LOOKUPS_PER_HOUR) error(429, 'That is a lot of keys for one hour; try later');
	mine.push(now);
	recentLookups.set(address, mine);
}

/** Parties made lately from one address: the provider pays for each, so a flood is refused. */
const recentEnrols = new Map<string, number[]>();
const ENROLS_PER_HOUR = 60;
/**
 * Who is asking, by address: the one the proxy in front worked out (`X-Client-Ip`, set by
 * Caddy from Cloudflare's headers only where the request came through Cloudflare, else from
 * the connection itself), so a header a visitor made up counts for nothing.
 */
function clientAddress(): string {
	try {
		const event = getRequestEvent();
		return event.request.headers.get('x-client-ip') ?? event.getClientAddress();
	} catch {
		return 'unknown';
	}
}
function pacedEnrol(): () => void {
	const address = clientAddress();
	const now = Date.now();
	const mine = (recentEnrols.get(address) ?? []).filter((t) => now - t < 3_600_000);
	if (mine.length >= ENROLS_PER_HOUR)
		error(429, 'That is a lot of new parties for one hour; try later');
	// Counted once the party exists: a failed attempt costs nothing.
	return () => {
		mine.push(Date.now());
		recentEnrols.set(address, mine);
	};
}

/** Writes a party made lately: a member's words and proposals cost the DAO, so a flood is refused. */
const recentWrites = new Map<string, number[]>();
const WRITES_PER_HOUR = 30;
function paced(party: string) {
	const now = Date.now();
	const mine = (recentWrites.get(party) ?? []).filter((t) => now - t < 3_600_000);
	if (mine.length >= WRITES_PER_HOUR)
		error(429, 'That is a lot of writing for one hour; try later');
	mine.push(now);
	recentWrites.set(party, mine);
}

export const commentForm = form(schemas.commentForm, async ({ proposal, body }) => {
	const p = proposalOf(proposal);
	const me = proposalReader(p);
	if (!me) error(403, 'Only members comment');
	paced(me.party);
	const cid = crypto.randomUUID();
	const args = { proposalId: proposal, cid, body };
	return {
		cid,
		membership: me.contractId,
		proposalId: proposal,
		body,
		prepared: await prepare(me.party, Main.Member, me.contractId, 'Member_Comment', args, p.daoId)
	};
});

/** The caller's profile: created or replaced from their Account. Their own cost, not a DAO's. */
export const profileForm = form(schemas.profileForm, async ({ name, avatar, bio }) => {
	const party = session.required();
	const account = accountOf(party).contractId;
	const previous = ledger.profiles.get(party)?.contractId ?? null;
	const args = { name, avatar: nullable(avatar), bio, previous };
	return {
		...args,
		prepared: await prepare(party, Main.Account, account, 'Account_SetProfile', args, null)
	};
});

/** The signed hash comes back; the participant submits, and the reply waits for the pages. */
export const execute = command(
	v.object({
		preparedTransaction: v.string(),
		preparedTransactionHash: base64,
		hashingSchemeVersion: v.string(),
		signature: base64
	}),
	async ({ signature, ...prepared }) => {
		const party = session.required();
		const known = participant.preparedFor(prepared.preparedTransactionHash);
		const updateId = await participant.execute(party, prepared, [
			{ fingerprint: party.split('::')[1], signature }
		]);
		await ledger.applied(updateId);
		if (known?.payer) void billing.settle(known.payer as billing.Account, updateId, party);
	}
);
