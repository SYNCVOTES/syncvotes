import { error } from '@sveltejs/kit';
import { ed25519 } from '@noble/curves/ed25519.js';
import { command, form, query } from '$app/server';
import * as v from 'valibot';
import { Main } from '@daml.js/model';
import * as participant from './server/participant';
import * as ledger from './server/ledger';
import * as session from './server/session';
import { fingerprintOf } from './verify';
import { normaliseHint, hintProblem } from './hint';
import * as schemas from './schemas';

/**
 * The server's API as remote functions: pages call these like local functions and SvelteKit
 * does the transport. Reads come from the in-memory ledger copy and are live — each sends its
 * value, then sends it again whenever what it shows changed — and need a read session (a
 * challenge signed by the party's key, `server/session.ts`) plus membership. Writes are
 * prepared here, signed in the browser and executed here; the ledger accepts them only with the
 * acting party's own signature.
 */

/** Runs `load` now and whenever `key` changes, yielding only when the result changed. */
async function* live<T>(key: string, load: () => T): AsyncGenerator<T> {
	let last = '';
	for (;;) {
		try {
			const value = load();
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
const partyId = v.pipe(v.string(), v.includes('::'), v.maxLength(300));
const contractId = v.pipe(v.string(), v.nonEmpty());
const paging = {
	offset: v.pipe(v.number(), v.integer(), v.minValue(0)),
	limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100))
};
const filter = v.optional(v.pipe(v.string(), v.maxLength(100)), '');

/** Members per transaction; the app splits longer lists. */
export const BATCH = 200;

type Page<T> = { items: T[]; total: number; offset: number };
const page = <T>(all: T[], offset: number, limit: number): Page<T> => ({
	items: all.slice(offset, offset + limit),
	total: all.length,
	offset
});
const matches = (needle: string) => (party: string) =>
	!needle || party.toLowerCase().includes(needle.trim().toLowerCase());

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
								user: party
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

/** The caller's membership of this DAO, or 403. */
const memberOnly = (daoId: string): ledger.Member => {
	const membership = ledger.members.get(daoId)?.get(session.required());
	if (!membership) error(403, 'Only members can see this DAO');
	return membership;
};

const summarise = (d: ledger.Dao) => ({
	...d,
	members: ledger.members.get(d.id)?.size ?? 0,
	proposals: proposalsOf(d.id).length,
	openProposals: openProposals(d.id)
});

/** The DAOs a party belongs to, newest first. */
export const myDaos = query.live(partyId, (party) =>
	live(ledger.keys.party(party), () => {
		session.required(party);
		return [...(ledger.memberships.get(party)?.keys() ?? [])]
			.flatMap((id) => ledger.daos.get(id) ?? [])
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
			.map(summarise);
	})
);

/** A DAO with its counts and the caller's standing in it. The lists are paged separately. */
export const dao = query.live(contractId, (id) =>
	live(ledger.keys.dao(id), () => {
		const me = memberOnly(id);
		const d = daoOf(id);
		return { ...summarise(d), me: { admin: d.admin === me.party, membership: me.contractId } };
	})
);

/** Members, alphabetically by party id, filtered by a substring of it. */
export const daoMembers = query.live(
	v.object({ id: contractId, ...paging, q: filter }),
	({ id, offset, limit, q }) =>
		live(ledger.keys.dao(id), () => {
			memberOnly(id);
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
			memberOnly(id);
			const all = proposalsOf(id).filter((p) =>
				status === 'open' ? !p.outcome : status === 'closed' ? !!p.outcome : true
			);
			return page(all, offset, limit);
		})
);

/** Which of these party ids can be added: registered, and not members yet. */
export const checkMembers = query(
	v.object({ dao: contractId, parties: v.pipe(v.array(partyId), v.maxLength(2000)) }),
	({ dao, parties }) => {
		const me = memberOnly(dao);
		const unique = [...new Set(parties)].filter((p) => p !== me.party);
		const isMember = (p: string) => ledger.members.get(dao)?.has(p) ?? false;
		return {
			registered: unique.filter((p) => ledger.accounts.has(p) && !isMember(p)),
			already: unique.filter(isMember),
			unknown: unique.filter((p) => !ledger.accounts.has(p))
		};
	}
);

const proposalOf = (id: string): ledger.Proposal => {
	const p = ledger.proposals.get(id);
	if (!p) error(404, 'No such proposal');
	return p;
};

/** The caller's membership of the proposal's DAO, or null for a proposer who left; 403 otherwise. */
const proposalReader = (p: ledger.Proposal): ledger.Member | null => {
	const me = session.required();
	const membership = ledger.members.get(p.daoId)?.get(me);
	if (!membership && p.proposer !== me) error(403, 'Only members can see this proposal');
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
		const mine = me && ledger.ballots.get(id)?.get(me.party);
		return {
			...p,
			daoContractId: ledger.daos.get(p.daoId)?.contractId ?? null,
			cast: ledger.ballots.get(id)?.size ?? 0,
			me: { membership: me?.contractId ?? null, vote: mine?.vote ?? null, mayVote: mayVote(p, me) }
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

// ---- Writes: prepared here, signed in the browser, executed here --------------------------

/**
 * Every write names its subject by id and is prepared on the current contract; the browser
 * signs only if that is the contract it is looking at (`verify.ts`), so a change that landed
 * in between is caught before anything is signed.
 */
const prepare = (
	party: string,
	template: { templateId: string },
	contractId: string,
	choice: string,
	choiceArgument: unknown
) =>
	participant.prepare(party, [
		{ ExerciseCommand: { templateId: template.templateId, contractId, choice, choiceArgument } }
	]);

const adminOf = (daoId: string, party: string): ledger.Dao => {
	const found = daoOf(daoId);
	if (found.admin !== party) error(403, 'Only the admin can do this');
	return found;
};

const draftOf = (proposalId: string, party: string): ledger.Proposal => {
	const found = proposalOf(proposalId);
	if (found.proposer !== party) error(403, 'Only the proposer can do this');
	if (found.openedAt) error(409, 'Voting has opened');
	return found;
};

/**
 * The text forms: each field is checked against the shared schema — in the browser before
 * submitting, so issues show under the field, and here again — then the transaction is
 * prepared. The browser verifies it says what the form said, signs it and executes it.
 */
export const createDaoForm = form(schemas.createDaoForm, async ({ daoName, description }) => {
	const party = session.required();
	const account = accountOf(party).contractId;
	const id = crypto.randomUUID();
	const args = { id, daoName, description };
	return { id, prepared: await prepare(party, Main.Account, account, 'Account_CreateDAO', args) };
});

export const updateDaoForm = form(schemas.updateDaoForm, async ({ dao, daoName, description }) => {
	const party = session.required();
	const { contractId } = adminOf(dao, party);
	const args = { daoName, description };
	return { prepared: await prepare(party, Main.DAO, contractId, 'DAO_Update', args) };
});

export const createProposalForm = form(
	schemas.createProposalForm,
	async ({ dao, title, description, days }) => {
		const party = session.required();
		const { contractId } = daoOf(dao);
		const membership = memberOnly(dao).contractId;
		const pid = crypto.randomUUID();
		const closesAt = new Date(Date.now() + days * 86_400_000).toISOString();
		const args = { proposer: party, membership, pid, title, description, closesAt };
		return {
			pid,
			membership,
			closesAt,
			prepared: await prepare(party, Main.DAO, contractId, 'DAO_CreateProposal', args)
		};
	}
);

export const updateProposalForm = form(
	schemas.updateProposalForm,
	async ({ proposal, title, description }) => {
		const party = session.required();
		const { contractId } = draftOf(proposal, party);
		const args = { title, description };
		return { prepared: await prepare(party, Main.Proposal, contractId, 'Proposal_Update', args) };
	}
);

/** Deleting archives the DAO. Its settled proposals stay readable; open ones block it. */
export const prepareArchiveDao = command(contractId, (daoId) => {
	const party = session.required();
	const { contractId } = adminOf(daoId, party);
	if (openProposals(daoId) > 0) error(409, 'Close or cancel the open proposals first');
	return prepare(party, Main.DAO, contractId, 'DAO_Archive', {});
});

/** A batch of new members: registered parties that are not members yet. */
export const prepareAddMembers = command(
	v.object({
		dao: contractId,
		parties: v.pipe(v.array(partyId), v.minLength(1), v.maxLength(BATCH))
	}),
	({ dao, parties }) => {
		const party = session.required();
		const { contractId } = adminOf(dao, party);
		for (const p of parties) {
			if (!ledger.accounts.has(p)) error(404, `${p} is not registered with the app`);
			if (ledger.members.get(dao)?.has(p)) error(409, `${p} is already a member`);
		}
		return prepare(party, Main.DAO, contractId, 'DAO_AddMembers', { parties });
	}
);

export const prepareRemoveMembers = command(
	v.object({
		dao: contractId,
		memberCids: v.pipe(v.array(contractId), v.minLength(1), v.maxLength(BATCH))
	}),
	({ dao, memberCids }) => {
		const party = session.required();
		const { contractId } = adminOf(dao, party);
		return prepare(party, Main.DAO, contractId, 'DAO_RemoveMembers', { memberCids });
	}
);

/** Opens the vote: the electorate is fixed to the DAO's members as of now. */
export const prepareOpenProposal = command(contractId, (proposalId) => {
	const party = session.required();
	const { contractId, daoId } = draftOf(proposalId, party);
	const dao = daoOf(daoId).contractId;
	return prepare(party, Main.Proposal, contractId, 'Proposal_Open', { dao });
});

export const prepareCancelProposal = command(contractId, (proposalId) => {
	const party = session.required();
	const { contractId, outcome, proposer, admin } = proposalOf(proposalId);
	if (outcome) error(409, 'Already settled');
	if (proposer !== party && admin !== party)
		error(403, 'Only the proposer or the DAO admin can cancel');
	return prepare(party, Main.Proposal, contractId, 'Proposal_Cancel', { canceller: party });
});

/** A ballot, cast from the voter's own membership contract. */
export const prepareVote = command(
	v.object({ proposal: contractId, vote: v.picklist(['Yes', 'No']) }),
	({ proposal, vote }) => {
		const p = proposalOf(proposal);
		const me = proposalReader(p);
		if (!me || !mayVote(p, me)) error(409, 'You have no vote on this proposal');
		const args = { proposalId: proposal, vote };
		return prepare(me.party, Main.Member, me.contractId, 'Member_Vote', args);
	}
);

/** The signed hash comes back; the participant submits, and the reply waits for the pages. */
export const execute = command(
	v.object({
		preparedTransaction: v.string(),
		preparedTransactionHash: base64,
		hashingSchemeVersion: v.string(),
		signature: base64
	}),
	async ({ signature, ...prepared }) => {
		const updateId = await participant.execute(session.required(), prepared, signature);
		await ledger.applied(updateId);
	}
);
