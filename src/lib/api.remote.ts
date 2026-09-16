import { error } from '@sveltejs/kit';
import { ed25519 } from '@noble/curves/ed25519.js';
import { command, query } from '$app/server';
import * as v from 'valibot';
import { Main } from '@daml.js/model';
import * as participant from './server/participant';
import * as app from './server/app';
import * as index from './server/index';
import { nextChange } from './server/feed';
import * as session from './server/session';
import { fingerprintOf } from './verify';
import { normaliseName, nameProblem } from './names';

/**
 * The server's API, as remote functions: the page calls these like local functions, SvelteKit
 * does the transport. Everything here runs on the server with the participant credentials; the
 * user's key stays in the browser and only ever contributes signatures.
 *
 * Reads come from the in-memory index and are live: each is a stream that sends its value, then
 * sends it again whenever what it shows changed. They need a read session — a challenge signed
 * by the party's key, once per unlock (`server/session.ts`) — and membership. Writes are
 * transactions the ledger accepts only with the acting party's own signature.
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
		await nextChange(key);
	}
}

const base64 = v.pipe(v.string(), v.nonEmpty(), v.base64());
const partyId = v.pipe(v.string(), v.includes('::'), v.maxLength(300));
const contractId = v.pipe(v.string(), v.nonEmpty());
const text = (max: number) => v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(max));
const paging = {
	offset: v.pipe(v.number(), v.integer(), v.minValue(0)),
	limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100))
};
const BATCH = 200;

// ---- Identity ----------------------------------------------------------------------------

/**
 * Who is this key? A party's namespace is the fingerprint of its key, so a registered party is
 * found by that alone. A key nobody has seen gets to choose the hint its party id will carry.
 */
export const lookup = query(base64, async (publicKey) => {
	const fingerprint = await fingerprintOf(new Uint8Array(Buffer.from(publicKey, 'base64')));
	const account = app.accountByFingerprint(fingerprint);
	return account
		? { exists: true as const, party: account.party, account: account.contractId, fingerprint }
		: { exists: false as const, fingerprint };
});

const hintOf = (hint: string) => {
	const chosen = normaliseName(hint);
	const problem = nameProblem(chosen);
	if (problem) throw error(400, problem);
	return chosen;
};

/** The party this key would be under this hint, and what the key has to sign to create it. */
export const topology = query(
	v.object({ publicKey: base64, hint: v.string() }),
	({ publicKey, hint }) => participant.generateTopology(hintOf(hint), publicKey)
);

/** The key signed its topology: create the party and its account. */
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
		if (!valid) throw error(403, 'The signature does not match the key');
		const chosen = hintOf(hint);
		const fresh = await participant.generateTopology(chosen, publicKey);
		if (fresh.multiHash !== multiHash)
			throw error(409, 'The party topology changed — sign in again');
		const { partyId } = await participant.allocateExternal(chosen, publicKey, multiHash, signature);
		const account = await app.register(partyId);
		return { party: account.party, account: account.contractId };
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

/** Whether a party id is registered — what a member chip checks itself against. */
export const member = query(v.pipe(v.string(), v.trim(), v.maxLength(300)), (token) => {
	session.required();
	return app.isRegistered(token) ? { party: token } : null;
});

/** Which of these party ids are registered — a pasted list, checked in one go. */
export const checkMembers = query(v.pipe(v.array(partyId), v.maxLength(2000)), (parties) => {
	session.required();
	const unique = [...new Set(parties)];
	return {
		registered: unique.filter((p) => app.isRegistered(p)),
		unknown: unique.filter((p) => !app.isRegistered(p))
	};
});

// ---- Reads -------------------------------------------------------------------------------

/** Counts for the landing ticker. Aggregates only — DAOs are private, their contents stay so. */
export const stats = query.live(() => live(index.keys.all, () => app.stats()));

const daoSummary = (d: app.Dao) => ({
	...d,
	members: app.memberCount(d.id),
	proposals: app.proposalsOf(d.id).length,
	openProposals: app.openCount(d.id)
});

/** The DAOs a party belongs to. */
export const myDaos = query.live(partyId, (party) =>
	live(index.keys.party(party), () => {
		session.required(party);
		return app.daosOf(party).map(daoSummary);
	})
);

const memberOnly = (daoId: string) => {
	const me = session.required();
	if (!app.isMember(daoId, me)) throw error(403, 'Only members can see this DAO');
	return me;
};

/** A DAO with its counts and the caller's standing in it. No lists: those are paged below. */
export const dao = query.live(contractId, (id) =>
	live(index.keys.dao(id), () => {
		const me = memberOnly(id);
		const d = app.daoById(id);
		const membership = app.memberOf(id, me)!;
		return { ...daoSummary(d), me: { admin: d.admin === me, membership: membership.contractId } };
	})
);

export const daoMembers = query.live(
	v.object({ id: contractId, ...paging, q: v.optional(v.pipe(v.string(), v.maxLength(100)), '') }),
	({ id, offset, limit, q }) =>
		live(index.keys.dao(id), () => {
			memberOnly(id);
			return app.membersOf(id, offset, limit, q);
		})
);

export const daoProposals = query.live(
	v.object({ id: contractId, ...paging, status: v.optional(v.picklist(['open', 'closed'])) }),
	({ id, offset, limit, status }) =>
		live(index.keys.dao(id), () => {
			memberOnly(id);
			return app.proposalPage(id, offset, limit, status);
		})
);

/** Member contract ids, for issuing voting rights in batches. */
export const memberCids = query(contractId, (id) => {
	memberOnly(id);
	return app.memberCids(id);
});

const proposalOnly = (p: app.Proposal) => {
	const me = session.required();
	if (!app.isMember(p.daoId, me) && p.proposer !== me)
		throw error(403, 'Only members can see this proposal');
	return me;
};

/** A proposal with its tally and the caller's standing: a right to vote, a ballot cast, or neither. */
export const proposal = query.live(contractId, (id) =>
	live(index.keys.proposal(id), () => {
		const p = app.proposalById(id);
		const me = proposalOnly(p);
		const right = app.rightOf(id, me);
		const ballot = app.ballotOf(id, me);
		return {
			...p,
			cast: app.ballotCount(id),
			me: { right: right?.contractId ?? null, vote: ballot?.vote ?? null }
		};
	})
);

export const proposalBallots = query.live(
	v.object({ id: contractId, ...paging, q: v.optional(v.pipe(v.string(), v.maxLength(100)), '') }),
	({ id, offset, limit, q }) =>
		live(index.keys.proposal(id), () => {
			proposalOnly(app.proposalById(id));
			return app.ballotPage(id, offset, limit, q);
		})
);

// ---- Writes: prepare here, sign in the browser, execute here ------------------------------

const exercise = (
	templateId: string,
	contractId: string,
	choice: string,
	choiceArgument: unknown
) => [{ ExerciseCommand: { templateId, contractId, choice, choiceArgument } }];

export const prepareCreateDao = command(
	v.object({
		party: partyId,
		daoName: text(60),
		description: v.pipe(v.string(), v.maxLength(2000)),
		id: v.pipe(v.string(), v.uuid())
	}),
	async ({ party, daoName, description, id }) => {
		session.required(party);
		const account = app.accountOf(party);
		if (index.daos.has(id)) throw error(409, 'That DAO id is taken');
		return participant.prepare(
			party,
			exercise(Main.Account.templateId, account.contractId, 'Account_CreateDAO', {
				daoName,
				description,
				id
			})
		);
	}
);

/** The DAO contract the browser saw, if it is still the current one and the caller is admin. */
function adminOf(contractId: string, party: string) {
	const found = app.currentDao(contractId);
	if (found.admin !== party) throw error(403, 'Only the admin can do this');
	return found;
}

export const prepareUpdateDao = command(
	v.object({
		party: partyId,
		dao: contractId,
		daoName: text(60),
		description: v.pipe(v.string(), v.maxLength(2000))
	}),
	async ({ party, dao, daoName, description }) => {
		session.required(party);
		adminOf(dao, party);
		return participant.prepare(
			party,
			exercise(Main.DAO.templateId, dao, 'DAO_Update', { daoName, description })
		);
	}
);

/** Deleting archives the DAO. Its settled proposals stay readable; open ones block it. */
export const prepareArchiveDao = command(
	v.object({ party: partyId, dao: contractId }),
	async ({ party, dao }) => {
		session.required(party);
		const found = adminOf(dao, party);
		if (app.openCount(found.id) > 0) throw error(409, 'Close or cancel the open proposals first');
		return participant.prepare(party, exercise(Main.DAO.templateId, dao, 'DAO_Archive', {}));
	}
);

/** A batch of new members: registered parties that are not members yet. */
export const prepareAddMembers = command(
	v.object({
		party: partyId,
		dao: contractId,
		parties: v.pipe(v.array(partyId), v.minLength(1), v.maxLength(BATCH))
	}),
	async ({ party, dao, parties }) => {
		session.required(party);
		const found = adminOf(dao, party);
		for (const p of parties) {
			if (!app.isRegistered(p)) throw error(404, `${p} is not registered with the app`);
			if (app.isMember(found.id, p)) throw error(409, `${p} is already a member`);
		}
		return participant.prepare(
			party,
			exercise(Main.DAO.templateId, dao, 'DAO_AddMembers', { parties })
		);
	}
);

export const prepareRemoveMembers = command(
	v.object({
		party: partyId,
		dao: contractId,
		members: v.pipe(v.array(contractId), v.minLength(1), v.maxLength(BATCH))
	}),
	async ({ party, dao, members }) => {
		session.required(party);
		adminOf(dao, party);
		return participant.prepare(
			party,
			exercise(Main.DAO.templateId, dao, 'DAO_RemoveMembers', { members })
		);
	}
);

export const prepareCreateProposal = command(
	v.object({
		party: partyId,
		dao: contractId,
		title: text(120),
		description: v.pipe(v.string(), v.maxLength(5000)),
		closesAt: v.pipe(v.string(), v.isoTimestamp()),
		pid: v.pipe(v.string(), v.uuid())
	}),
	async ({ party, dao, title, description, closesAt, pid }) => {
		session.required(party);
		const found = app.currentDao(dao);
		const membership = app.memberOf(found.id, party);
		if (!membership) throw error(403, 'Only members can propose');
		// The browser picks the deadline and the id so it can check them before signing; the
		// server only keeps them within bounds and unique.
		const days = (new Date(closesAt).getTime() - Date.now()) / 86_400_000;
		if (!(days > 0.5 && days <= 31)) throw error(400, 'The voting period must be 1 to 30 days');
		if (index.proposals.has(pid)) throw error(409, 'That proposal id is taken');
		return participant.prepare(
			party,
			exercise(Main.DAO.templateId, dao, 'DAO_CreateProposal', {
				proposer: party,
				membership: membership.contractId,
				title,
				description,
				closesAt,
				pid
			})
		);
	}
);

/** The proposal contract the browser saw, if still current and the caller is its proposer. */
function proposerOf(contractId: string, party: string) {
	const current = app.currentProposal(contractId);
	if (current.proposer !== party) throw error(403, 'Only the proposer can do this');
	return current;
}

export const prepareIssueRights = command(
	v.object({
		party: partyId,
		proposal: contractId,
		members: v.pipe(v.array(contractId), v.minLength(1), v.maxLength(BATCH))
	}),
	async ({ party, proposal, members }) => {
		session.required(party);
		const current = proposerOf(proposal, party);
		if (current.ready) throw error(409, 'Voting has opened');
		return participant.prepare(
			party,
			exercise(Main.Proposal.templateId, proposal, 'Proposal_IssueRights', { members })
		);
	}
);

export const prepareReady = command(
	v.object({ party: partyId, proposal: contractId }),
	async ({ party, proposal }) => {
		session.required(party);
		const current = proposerOf(proposal, party);
		if (current.ready) throw error(409, 'Voting has opened');
		return participant.prepare(
			party,
			exercise(Main.Proposal.templateId, proposal, 'Proposal_Ready', {})
		);
	}
);

export const prepareUpdateProposal = command(
	v.object({
		party: partyId,
		proposal: contractId,
		title: text(120),
		description: v.pipe(v.string(), v.maxLength(5000))
	}),
	async ({ party, proposal, title, description }) => {
		session.required(party);
		const current = proposerOf(proposal, party);
		if (current.ready) throw error(409, 'Voting has opened; the text is fixed');
		return participant.prepare(
			party,
			exercise(Main.Proposal.templateId, proposal, 'Proposal_Update', { title, description })
		);
	}
);

export const prepareCancelProposal = command(
	v.object({ party: partyId, proposal: contractId }),
	async ({ party, proposal }) => {
		session.required(party);
		const current = app.currentProposal(proposal);
		if (current.outcome) throw error(409, 'Already settled');
		if (current.proposer !== party && current.admin !== party)
			throw error(403, 'Only the proposer or the DAO admin can cancel');
		return participant.prepare(
			party,
			exercise(Main.Proposal.templateId, proposal, 'Proposal_Cancel', { canceller: party })
		);
	}
);

/** A ballot spends the voting right the browser was shown. */
export const prepareVote = command(
	v.object({ party: partyId, right: contractId, vote: v.picklist(['Yes', 'No']) }),
	async ({ party, right, vote }) => {
		session.required(party);
		return participant.prepare(
			party,
			exercise(Main.VoteRight.templateId, right, 'VoteRight_Cast', { vote })
		);
	}
);

/** The signed hash comes back; the participant submits and waits for the result. */
export const execute = command(
	v.object({
		party: partyId,
		preparedTransaction: v.string(),
		preparedTransactionHash: base64,
		hashingSchemeVersion: v.string(),
		signature: base64
	}),
	async ({ party, signature, ...prepared }) => {
		await participant.execute(party, prepared, signature);
	}
);
