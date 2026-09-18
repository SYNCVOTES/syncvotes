import { error } from '@sveltejs/kit';
import { ed25519 } from '@noble/curves/ed25519.js';
import { command, form, query } from '$app/server';
import * as v from 'valibot';
import { Main } from '@daml.js/model';
import * as participant from './server/participant';
import * as ledger from './server/ledger';
import * as session from './server/session';
import * as billing from './server/billing';
import * as splice from './server/splice';
import * as treasury from './server/treasury';
import { fingerprintOf } from './verify';
import { normaliseHint, hintProblem } from './hint';
import * as schemas from './schemas';

/**
 * The server's API as remote functions: pages call these like local functions and SvelteKit
 * does the transport. Reads come from the in-memory ledger copy and are live — each sends its
 * value, then sends it again whenever what it shows changed — and need a read session (a
 * challenge signed by the party's key, `server/session.ts`) plus membership. Writes are
 * prepared here, signed in the browser and executed here; the ledger accepts them only with the
 * acting party's own signature. A DAO's writes are refused once its balance is spent.
 */

/** Runs `load` now and whenever `key` changes, yielding only when the result changed. */
async function* live<T>(key: string, load: () => T | Promise<T>): AsyncGenerator<T> {
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
		}
		await ledger.nextChange(key);
	}
}

const base64 = v.pipe(v.string(), v.nonEmpty(), v.base64());
const partyId = schemas.partyId;
const contractId = v.pipe(v.string(), v.nonEmpty());
const paging = {
	offset: v.pipe(v.number(), v.integer(), v.minValue(0)),
	limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100))
};
const filter = v.optional(v.pipe(v.string(), v.maxLength(100)), '');

type Page<T> = { items: T[]; total: number; offset: number };
const page = <T>(all: T[], offset: number, limit: number): Page<T> => ({
	items: all.slice(offset, offset + limit),
	total: all.length,
	offset
});
const matches = (needle: string) => (party: string) =>
	!needle || party.toLowerCase().includes(needle.trim().toLowerCase());

/** The parties and prices the browser checks transactions against. Public, nothing secret. */
export const config = query(async () => ({
	provider: participant.providerParty(),
	operator: participant.operatorParty(),
	instrument: await splice.instrument(),
	prices: await splice.prices()
}));

// ---- Identity ----------------------------------------------------------------------------

const accountOf = (party: string): ledger.Account => {
	const account = ledger.accounts.get(party);
	if (!account) error(404, 'This party is not registered with the app');
	return account;
};

/**
 * Who is this key? A party's namespace is the fingerprint of its key, so a registered party is
 * found by that alone. A key nobody has seen gets to choose the hint its party id will carry.
 */
export const lookup = query(base64, async (publicKey) => {
	const fingerprint = await fingerprintOf(new Uint8Array(Buffer.from(publicKey, 'base64')));
	for (const account of ledger.accounts.values()) {
		if (account.party.split('::')[1] === fingerprint) {
			return { exists: true as const, party: account.party, account: account.contractId };
		}
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

/** The key signed its topology: create the party, then its Account. */
export const enrol = command(
	v.object({ publicKey: base64, hint: v.string(), multiHash: base64, signature: base64 }),
	async ({ publicKey, hint, multiHash, signature }) => {
		// The ledger verifies this signature when it allocates a new party; for a party that
		// already exists it never looks, so check here too.
		const valid = ed25519.verify(
			Buffer.from(signature, 'base64'),
			Buffer.from(multiHash, 'base64'),
			Buffer.from(publicKey, 'base64')
		);
		if (!valid) error(403, 'The signature does not match the key');
		const { partyId: party } = await participant.allocateParty(
			hintOf(hint),
			publicKey,
			multiHash,
			signature
		);
		if (!ledger.accounts.has(party)) {
			const updateId = await participant.submitAsProvider(
				[
					{
						CreateCommand: {
							templateId: Main.Account.templateId,
							createArguments: {
								provider: participant.providerParty(),
								operator: participant.operatorParty(),
								user: party,
								publicKey
							}
						}
					}
				],
				`register-${party.split('::')[1]}`
			);
			await ledger.applied(updateId);
		}
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
		return {
			daos: ledger.daos.size,
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
const isAdmin = (dao: ledger.Dao, party: string) => dao.admins.includes(party);

/** The caller's standing in this DAO — a member, or an admin named by a vote — or 403. */
const insiderOnly = (daoId: string) => {
	const me = session.required();
	const membership = ledger.members.get(daoId)?.get(me) ?? null;
	const dao = ledger.daos.get(daoId);
	if (!membership && !(dao && isAdmin(dao, me))) error(403, 'Only members can see this DAO');
	return { me, membership };
};

/** The caller's membership of this DAO, or 403. */
const memberOnly = (daoId: string): ledger.Member => {
	const { membership } = insiderOnly(daoId);
	if (!membership) error(403, 'Only members can do this');
	return membership;
};

const summarise = (d: ledger.Dao) => ({
	...d,
	members: ledger.members.get(d.id)?.size ?? 0,
	proposals: proposalsOf(d.id).length,
	openProposals: openProposals(d.id)
});

/** The DAOs a party belongs to or runs, newest first. */
export const myDaos = query.live(partyId, (party) =>
	live(ledger.keys.party(party), () => {
		session.required(party);
		const ids = new Set(ledger.memberships.get(party)?.keys() ?? []);
		for (const d of ledger.daos.values()) if (isAdmin(d, party)) ids.add(d.id);
		return [...ids]
			.flatMap((id) => ledger.daos.get(id) ?? [])
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
			.map(summarise);
	})
);

/** A DAO with its counts and the caller's standing in it. The lists are paged separately. */
export const dao = query.live(contractId, (id) =>
	live(ledger.keys.dao(id), () => {
		const { me, membership } = insiderOnly(id);
		const d = daoOf(id);
		return {
			...summarise(d),
			balance: billing.balance(id),
			me: { admin: isAdmin(d, me), membership: membership?.contractId ?? null }
		};
	})
);

/** Members, alphabetically by party id, filtered by a substring of it. */
export const daoMembers = query.live(
	v.object({ id: contractId, ...paging, q: filter }),
	({ id, offset, limit, q }) =>
		live(ledger.keys.dao(id), () => {
			insiderOnly(id);
			const all = membersOf(id)
				.filter((m) => matches(q)(m.party))
				.sort((a, b) => a.party.localeCompare(b.party));
			return page(all, offset, limit);
		})
);

export const daoProposals = query.live(
	v.object({ id: contractId, ...paging, status: v.optional(v.picklist(['open', 'closed'])) }),
	({ id, offset, limit, status }) =>
		live(ledger.keys.dao(id), () => {
			insiderOnly(id);
			const all = proposalsOf(id).filter((p) =>
				status === 'open' ? !p.outcome : status === 'closed' ? !!p.outcome : true
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
		parties: v.pipe(v.array(partyId), v.maxLength(100))
	}),
	({ dao, parties }): Record<string, PartyCheck> => {
		if (dao) insiderOnly(dao);
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

/** The caller's membership of the proposal's DAO, or null for a proposer or admin; 403 otherwise. */
const proposalReader = (p: ledger.Proposal): ledger.Member | null => {
	const me = session.required();
	const membership = ledger.members.get(p.daoId)?.get(me);
	const dao = ledger.daos.get(p.daoId);
	if (!membership && p.proposer !== me && !(dao && isAdmin(dao, me))) {
		error(403, 'Only members can see this proposal');
	}
	return membership ?? null;
};

/** Whether this member may vote on this proposal: a ballot cast now would count, and none was. */
const mayVote = (p: ledger.Proposal, m: ledger.Member | null) =>
	!!m &&
	!p.outcome &&
	ledger.eligible(p, { since: m.since, castAt: new Date().toISOString() }) &&
	!ledger.ballots.get(p.id)?.has(m.party);

/** A proposal with its tally and the caller's standing: a ballot cast, a vote to cast, or neither. */
export const proposal = query.live(contractId, (id) =>
	live(ledger.keys.proposal(id), () => {
		const p = proposalOf(id);
		const me = proposalReader(p);
		const who = session.required();
		const dao = ledger.daos.get(p.daoId);
		const mine = me && ledger.ballots.get(id)?.get(me.party);
		const due = ledger.payouts.get(p.daoId)?.get(p.id) ?? null;
		return {
			...p,
			daoName: dao?.name ?? null,
			cast: ledger.ballots.get(id)?.size ?? 0,
			payoutDue: due,
			me: {
				membership: me?.contractId ?? null,
				vote: mine?.vote ?? null,
				weight: mine?.weight ?? null,
				mayVote: mayVote(p, me),
				admin: !!dao && isAdmin(dao, who)
			}
		};
	})
);

/** Ballots, newest first, filtered by a substring of the voter's party id. */
export const proposalBallots = query.live(
	v.object({ id: contractId, ...paging, q: filter }),
	({ id, offset, limit, q }) =>
		live(ledger.keys.proposal(id), () => {
			proposalReader(proposalOf(id));
			const all = [...(ledger.ballots.get(id)?.values() ?? [])]
				.filter((b) => matches(q)(b.voter))
				.sort((a, b) => b.castAt.localeCompare(a.castAt));
			return page(all, offset, limit);
		})
);

/** The DAO's account: paid in, spent, what a byte costs it. */
export const daoBilling = query.live(contractId, (id) =>
	live(ledger.keys.dao(id), () => {
		insiderOnly(id);
		return billing.statement(id);
	})
);

/**
 * The caller's coin: free and locked, with what the network says a coin is worth; whether
 * coin sent to them just lands, and what waits to be accepted meanwhile.
 */
export const myHoldings = query(async () => {
	const party = session.required();
	const [holdings, prices, setup, incoming] = await Promise.all([
		splice.holdings(party),
		splice.prices(),
		splice.setupState(party),
		splice.incoming(party)
	]);
	return { holdings, prices, approved: setup.approved, incoming };
});

/**
 * Opens the caller's party to deposits: the validator offers a pre-approval (it pays for it
 * and keeps it renewed), the party accepts it with one signature. Asked at sign-up, and
 * from the wallet page for a party that skipped it.
 */
export const prepareAcceptDeposits = command(async () => {
	const party = session.required();
	let { proposal, approved } = await splice.setupState(party);
	if (approved) error(409, 'Deposits already land');
	if (!proposal) {
		await splice.proposeSetup(party);
		for (let i = 0; i < 30 && !proposal; i++) {
			await new Promise((r) => setTimeout(r, 1000));
			proposal = (await splice.setupState(party)).proposal;
		}
		if (!proposal) error(503, 'The validator has not offered the pre-approval yet — try again');
	}
	return {
		proposal: proposal.contractId,
		prepared: await participant.prepare(party, [
			{
				ExerciseCommand: {
					templateId: splice.SETUP_PROPOSAL,
					contractId: proposal.contractId,
					choice: 'ExternalPartySetupProposal_Accept',
					choiceArgument: {}
				}
			}
		])
	};
});

/** Accepts coin that was sent without a pre-approval in place. */
export const prepareAcceptIncoming = command(contractId, async (cid) => {
	const party = session.required();
	if (!(await splice.incoming(party)).some((t) => t.contractId === cid))
		error(404, 'No such transfer');
	const [cmd, disclosed] = await splice.acceptCommand(cid);
	return participant.prepare(party, [cmd], { disclosedContracts: disclosed });
});

/** The DAO's treasury: what it holds, what is due, a setup under way, sessions to sign. */
export const daoTreasury = query.live(contractId, (id) =>
	live(ledger.keys.dao(id), async () => {
		insiderOnly(id);
		const d = daoOf(id);
		const setup = await treasury.setup(id);
		if (setup && d.treasury?.party === setup.party) treasury.finish(id);
		const party = d.treasury?.party ?? (setup?.allocated ? setup.party : null);
		const holdings = party ? await splice.holdings(party) : [];
		return {
			treasury: d.treasury,
			stale: !!d.treasury && [...d.treasury.signers].sort().join() !== [...d.admins].sort().join(),
			setup: d.treasury && !setup ? null : setup,
			plan: treasury.current(id),
			balance: holdings.reduce((s, h) => s + (h.lock ? 0 : h.amount), 0),
			approved: party ? (await splice.setupState(party)).approved : false,
			due: [...(ledger.payouts.get(id)?.values() ?? [])].sort((a, b) =>
				a.createdAt.localeCompare(b.createdAt)
			),
			sessions: treasury.sessionsOf(id)
		};
	})
);

// ---- Writes: prepared here, signed in the browser, executed here --------------------------

/**
 * Every write names its subject by id and is prepared on the current contract; the browser
 * signs only if that is the contract it is looking at (`verify.ts`), so a change that landed
 * in between is caught before anything is signed. A DAO's writes need its balance.
 */
const prepare = (
	party: string,
	template: { templateId: string },
	contractId: string,
	choice: string,
	choiceArgument: unknown,
	dao: string | null
) => {
	if (dao) billing.funded(dao);
	return participant.prepare(
		party,
		[{ ExerciseCommand: { templateId: template.templateId, contractId, choice, choiceArgument } }],
		{ dao }
	);
};

const adminOf = (daoId: string, party: string): ledger.Dao => {
	const found = daoOf(daoId);
	if (!isAdmin(found, party)) error(403, 'Only an admin can do this');
	return found;
};

const votingOf = async (kind: 'member' | 'stake', quorum: number) =>
	kind === 'stake'
		? {
				tag: 'ByStake',
				value: { instrument: await splice.instrument(), quorum: quorum.toFixed(10) }
			}
		: { tag: 'ByMember', value: {} };

/**
 * The text forms: each field is checked against the shared schema — in the browser before
 * submitting, so issues show under the field, and here again — then the transaction is
 * prepared. The browser verifies it says what the form said, signs it and executes it.
 */
export const createDaoForm = form(
	schemas.createDaoForm,
	async ({ daoName, description, members, admins, voting, quorum }) => {
		const party = session.required();
		const account = accountOf(party).contractId;
		for (const p of [...members, ...admins]) {
			if (!ledger.accounts.has(p)) error(404, `${p} is not registered with the app`);
		}
		const id = crypto.randomUUID();
		const leads = admins.length ? admins : [party];
		const args = {
			id,
			daoName,
			description,
			members,
			admins: leads,
			voting: await votingOf(voting, quorum)
		};
		return {
			id,
			admins: leads,
			voting: args.voting,
			prepared: await prepare(party, Main.Account, account, 'Account_CreateDAO', args, null)
		};
	}
);

export const updateDaoForm = form(schemas.updateDaoForm, async ({ dao, daoName, description }) => {
	const party = session.required();
	const { contractId } = adminOf(dao, party);
	const args = { admin: party, daoName, description };
	return { prepared: await prepare(party, Main.DAO, contractId, 'DAO_Update', args, dao) };
});

export const prepareSetAdmins = command(
	v.object({ dao: contractId, admins: v.pipe(v.array(partyId), v.minLength(1), v.maxLength(50)) }),
	({ dao, admins }) => {
		const party = session.required();
		const { contractId } = adminOf(dao, party);
		for (const p of admins) {
			if (!ledger.members.get(dao)?.has(p)) error(409, `${p} is not a member`);
		}
		const args = { admin: party, newAdmins: admins };
		return prepare(party, Main.DAO, contractId, 'DAO_SetAdmins', args, dao);
	}
);

export const prepareSetVoting = command(
	v.object({ dao: contractId, voting: schemas.votingKind, quorum: schemas.quorum }),
	async ({ dao, voting, quorum }) => {
		const party = session.required();
		const { contractId } = adminOf(dao, party);
		const newVoting = await votingOf(voting, quorum);
		return {
			voting: newVoting,
			prepared: await prepare(
				party,
				Main.DAO,
				contractId,
				'DAO_SetVoting',
				{ admin: party, newVoting },
				dao
			)
		};
	}
);

export const createProposalForm = form(
	schemas.createProposalForm,
	async ({ dao, title, description, days, kind, payoutTo, payoutAmount, add, remove, admins }) => {
		const party = session.required();
		const membership = memberOnly(dao).contractId;
		const d = daoOf(dao);
		const pid = crypto.randomUUID();
		const closesAt = new Date(Date.now() + days * 86_400_000).toISOString();
		let action: { tag: string; value: unknown };
		switch (kind) {
			case 'payout':
				if (!d.treasury) error(409, 'This DAO has no treasury to pay from');
				action = { tag: 'Payout', value: { to: payoutTo, amount: payoutAmount.toFixed(10) } };
				break;
			case 'members':
				for (const p of add) {
					if (!ledger.accounts.has(p)) error(404, `${p} is not registered with the app`);
					if (ledger.members.get(dao)?.has(p)) error(409, `${p} is already a member`);
				}
				for (const p of remove) {
					if (!ledger.members.get(dao)?.has(p)) error(409, `${p} is not a member`);
					if (p === d.creator) error(409, 'The creator stays a member');
				}
				action = { tag: 'SetMembers', value: { add, remove } };
				break;
			case 'admins':
				for (const p of admins) {
					if (!ledger.members.get(dao)?.has(p)) error(409, `${p} is not a member`);
				}
				action = { tag: 'SetAdmins', value: { admins } };
				break;
			default:
				action = { tag: 'Signal', value: {} };
		}
		const args = { dao: d.contractId, pid, title, description, closesAt, action };
		return {
			pid,
			membership,
			dao: d.contractId,
			closesAt,
			action,
			prepared: await prepare(party, Main.Member, membership, 'Member_Propose', args, dao)
		};
	}
);

/** Deleting archives the DAO. Its settled proposals stay readable; open ones block it. */
export const prepareArchiveDao = command(contractId, (daoId) => {
	const party = session.required();
	const { contractId } = adminOf(daoId, party);
	if (openProposals(daoId) > 0) error(409, 'Close or cancel the open proposals first');
	return prepare(party, Main.DAO, contractId, 'DAO_Archive', { admin: party }, daoId);
});

/** A batch of new members: registered parties that are not members yet. */
export const prepareAddMembers = command(
	v.object({
		dao: contractId,
		parties: v.pipe(v.array(partyId), v.minLength(1), v.maxLength(schemas.BATCH))
	}),
	({ dao, parties }) => {
		const party = session.required();
		const { contractId } = adminOf(dao, party);
		for (const p of parties) {
			if (!ledger.accounts.has(p)) error(404, `${p} is not registered with the app`);
			if (ledger.members.get(dao)?.has(p)) error(409, `${p} is already a member`);
		}
		return prepare(party, Main.DAO, contractId, 'DAO_AddMembers', { admin: party, parties }, dao);
	}
);

export const prepareRemoveMembers = command(
	v.object({
		dao: contractId,
		memberCids: v.pipe(v.array(contractId), v.minLength(1), v.maxLength(schemas.BATCH))
	}),
	({ dao, memberCids }) => {
		const party = session.required();
		const { contractId } = adminOf(dao, party);
		const args = { admin: party, memberCids };
		return prepare(party, Main.DAO, contractId, 'DAO_RemoveMembers', args, dao);
	}
);

export const prepareCancelProposal = command(contractId, async (proposalId) => {
	const party = session.required();
	const { contractId, outcome, proposer, daoId } = proposalOf(proposalId);
	const d = daoOf(daoId);
	if (outcome) error(409, 'Already settled');
	if (proposer !== party && !isAdmin(d, party))
		error(403, 'Only the proposer or an admin can cancel');
	const args = { canceller: party, dao: d.contractId };
	return {
		dao: d.contractId,
		prepared: await prepare(party, Main.Proposal, contractId, 'Proposal_Cancel', args, daoId)
	};
});

/**
 * A ballot, cast from the voter's own membership contract. In a stake DAO it names the voter's
 * locked holdings that outlast the deadline; the ledger reads their weight.
 */
export const prepareVote = command(
	v.object({
		proposal: contractId,
		vote: v.picklist(['Yes', 'No', 'Abstain']),
		holdings: v.optional(v.pipe(v.array(contractId), v.maxLength(20)), [])
	}),
	async ({ proposal, vote, holdings }) => {
		const p = proposalOf(proposal);
		const me = proposalReader(p);
		if (!me || !mayVote(p, me)) error(409, 'You have no vote on this proposal');
		const stake =
			p.voting.kind === 'stake'
				? (() => {
						if (holdings.length === 0) error(409, 'Lock some coin past the deadline to vote here');
						// A Daml pair travels as `_1`/`_2`.
						return { _1: p.voting.instrument, _2: holdings };
					})()
				: null;
		const args = { proposalId: proposal, closesAt: p.closesAt, vote, stake };
		return prepare(me.party, Main.Member, me.contractId, 'Member_Vote', args, p.daoId);
	}
);

// ---- Coin: stake locks and the DAO's balance ----------------------------------------------

/** Locks coin in the caller's wallet for `days`; the DAO is not involved and nothing is charged. */
export const prepareLock = command(schemas.lockForm, async ({ amount, days }) => {
	const party = session.required();
	const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
	const [cmd, disclosed] = await splice.lockCommand(
		party,
		amount.toFixed(10),
		expiresAt,
		'syncvotes stake'
	);
	return {
		expiresAt,
		amount: amount.toFixed(10),
		prepared: await participant.prepare(party, [cmd], { disclosedContracts: disclosed })
	};
});

/** Releases a lock whose time has come. */
export const prepareRelease = command(contractId, async (cid) => {
	const party = session.required();
	const locked = (await splice.holdings(party)).find((h) => h.contractId === cid && h.lock);
	if (!locked) error(404, 'No such lock');
	if (new Date(locked.lock!.expiresAt).getTime() > Date.now()) error(409, 'Still locked');
	return participant.prepare(party, [splice.releaseCommand(locked)]);
});

/** Hashes of top-ups under way, so the credit lands with the coin. */
const topUps = new Map<string, { dao: string; amount: number }>();

/** Coin from the caller to the provider, credited to the DAO's balance when it lands. */
export const topUpForm = form(schemas.topUpForm, async ({ dao, amount }) => {
	const party = session.required();
	insiderOnly(dao);
	const [cmd, disclosed] = await splice.transferCommand(
		party,
		participant.providerParty(),
		amount.toFixed(10),
		`syncvotes:${dao}`
	);
	const prepared = await participant.prepare(party, [cmd], { disclosedContracts: disclosed });
	topUps.set(prepared.preparedTransactionHash, { dao, amount });
	return { amount: amount.toFixed(10), prepared };
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
		const topUp = topUps.get(prepared.preparedTransactionHash);
		if (topUp) {
			topUps.delete(prepared.preparedTransactionHash);
			await billing.credit(topUp.dao, topUp.amount);
		}
		if (known?.dao) void billing.settle(known.dao, updateId, party);
	}
);

// ---- Treasury: built by every admin, run by a threshold of them ----------------------------

/** Starts the ceremony: the treasury the current admins would own, for each of them to sign. */
export const treasuryBegin = command(
	v.object({ dao: contractId, threshold: v.pipe(v.number(), v.integer(), v.minValue(1)) }),
	({ dao, threshold }) => {
		const party = session.required();
		adminOf(dao, party);
		return treasury.begin(dao, threshold);
	}
);

/** An admin's signature over the treasury's identity. */
export const treasurySignSetup = command(
	v.object({ dao: contractId, signature: base64 }),
	({ dao, signature }) => treasury.signSetup(dao, session.required(), signature)
);

/** Records the built treasury on the DAO, signed by an admin who checked it is the one planned. */
export const prepareRecordTreasury = command(contractId, async (dao) => {
	const party = session.required();
	const { contractId } = adminOf(dao, party);
	const p = treasury.current(dao);
	if (!p) error(409, 'No treasury has been built');
	const newTreasury = {
		party: p.party,
		signers: p.owners.map((o) => o.party),
		threshold: p.threshold
	};
	return {
		treasury: newTreasury,
		prepared: await prepare(
			party,
			Main.DAO,
			contractId,
			'DAO_SetTreasury',
			{ admin: party, newTreasury },
			dao
		)
	};
});

/** Lets go of a treasury whose signers are no longer the admins; its coin is moved first. */
export const prepareDropTreasury = command(contractId, (dao) => {
	const party = session.required();
	const { contractId } = adminOf(dao, party);
	return prepare(
		party,
		Main.DAO,
		contractId,
		'DAO_SetTreasury',
		{ admin: party, newTreasury: null },
		dao
	);
});

const intent = v.variant('kind', [
	v.object({ kind: v.literal('approve'), proposal: v.optional(v.string(), '') }),
	v.object({
		kind: v.literal('payout'),
		due: contractId,
		to: v.optional(v.string(), ''),
		amount: v.optional(v.number(), 0)
	}),
	v.object({ kind: v.literal('move'), to: partyId, amount: schemas.coin })
]);

/** Opens a signing session for the treasury: the prepared transaction, for signers to check. */
export const treasuryOpen = command(v.object({ dao: contractId, intent }), ({ dao, intent }) => {
	const party = session.required();
	adminOf(dao, party);
	billing.funded(dao);
	return treasury.open(dao, intent as treasury.Intent);
});

/** A signer's signature over a session's hash. */
export const treasurySign = command(
	v.object({ session: v.string(), signature: base64 }),
	({ session: id, signature }) => treasury.sign(id, session.required(), signature)
);
