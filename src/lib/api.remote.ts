import { error } from '@sveltejs/kit';
import { ed25519 } from '@noble/curves/ed25519.js';
import { command, query } from '$app/server';
import * as v from 'valibot';
import { Main } from '@daml.js/model';
import * as participant from './server/participant';
import * as app from './server/app';
import { nextChange } from './server/feed';
import * as session from './server/session';

/**
 * The server's API, as remote functions: the page calls these like local functions, SvelteKit
 * does the transport. Everything here runs on the server with the participant credentials; the
 * user's key stays in the browser and only ever contributes signatures.
 *
 * Reads of a party's DAOs need a read session — a challenge signed by that party's key, once
 * per unlock (`server/session.ts`); the app is the operator and sees every DAO, so it is the app
 * that keeps them to their members. Writes are transactions the ledger accepts only with the
 * acting party's own signature.
 *
 * Reads are live: each is a stream that sends its value, then sends it again whenever the ledger
 * feed reports a change and the value differs. Nothing on the client polls or refreshes.
 */

/** Runs `load` now and after every ledger change, yielding only when the result changed. */
async function* live<T>(load: () => Promise<T>): AsyncGenerator<T> {
	let last = '';
	for (;;) {
		try {
			const value = await load();
			const key = JSON.stringify(value);
			if (key !== last) {
				last = key;
				yield value;
			}
		} catch (e) {
			// Gone (a 404) is a value too; anything else surfaces once and the stream keeps watching.
			if (last === '') throw e;
		}
		await nextChange();
	}
}

const base64 = v.pipe(v.string(), v.nonEmpty(), v.base64());
const partyId = v.pipe(v.string(), v.includes('::'));
const contractId = v.pipe(v.string(), v.nonEmpty());
const text = (max: number) => v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(max));

// ---- Identity ----------------------------------------------------------------------------

/**
 * Who is this key? The participant derives the party id from it. If that party already exists
 * the user is returning; otherwise the result carries what the key has to sign to create it.
 */
export const lookup = query(base64, async (publicKey) => {
	const topology = await participant.generateTopology(app.PARTY_HINT, publicKey);
	const exists = await participant.partyExists(topology.partyId);
	const account = exists
		? (await app.accounts()).find((a) => a.party === topology.partyId)
		: undefined;

	return { ...topology, exists, name: account?.name ?? null, account: account?.contractId ?? null };
});

/** The key signed its topology: create the party and register its name. */
export const enrol = command(
	v.object({
		publicKey: base64,
		multiHash: base64,
		signature: base64,
		name: v.pipe(v.string(), v.maxLength(60))
	}),
	async ({ publicKey, multiHash, signature, name }) => {
		// The ledger verifies this signature when it allocates a new party; for a party that
		// already exists it never looks, so check here — or anyone holding a public key could
		// register that party under a name of their choosing.
		const valid = ed25519.verify(
			Buffer.from(signature, 'base64'),
			Buffer.from(multiHash, 'base64'),
			Buffer.from(publicKey, 'base64')
		);
		if (!valid) throw error(403, 'The signature does not match the key');

		const chosen = app.normaliseName(name);
		const topology = await participant.generateTopology(app.PARTY_HINT, publicKey);
		if (topology.multiHash !== multiHash)
			throw error(409, 'The party topology changed — sign in again');

		// Name before allocation: a party allocated and then refused a name is stuck.
		const all = await app.accounts();
		const mine = all.find((a) => a.party === topology.partyId);
		if (!mine && all.some((a) => a.name === chosen))
			throw error(409, `The name "${chosen}" is taken`);

		// The SDK checks whether the party exists before allocating, so a returning key that never
		// finished registering lands here too and just gets its name.
		const { partyId } = await participant.allocateExternal(
			app.PARTY_HINT,
			publicKey,
			multiHash,
			signature
		);

		const account = await app.register(partyId, chosen);
		return { party: account.party, name: account.name, account: account.contractId };
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

/** The directory: every registered name, for picking members. */
export const directory = query(async () =>
	(await app.accounts()).map(({ party, name }) => ({ party, name }))
);

// ---- Reads -------------------------------------------------------------------------------

/** Counts for the landing ticker. Aggregates only — DAOs are private, their contents stay so. */
export const stats = query.live(() =>
	live(async () => {
		const [daos, proposals, accounts] = await Promise.all([
			app.daos(),
			app.proposals(),
			app.accounts()
		]);
		return {
			daos: daos.length,
			openProposals: proposals.filter((p) => !p.outcome).length,
			votesCast: proposals.reduce((n, p) => n + p.ballots.length, 0),
			members: accounts.length
		};
	})
);

/** The DAOs a party belongs to, with their open proposal count. */
export const myDaos = query.live(partyId, (party) =>
	live(async () => {
		session.required(party);
		const [daos, proposals] = await Promise.all([app.daos(), app.proposals()]);
		return daos
			.filter((d) => d.members.includes(party))
			.map((d) => ({
				...d,
				openProposals: proposals.filter((p) => p.daoId === d.id && !p.outcome).length
			}));
	})
);

export const dao = query.live(contractId, (id) =>
	live(async () => {
		const me = session.required();
		const [found, proposals, names] = await Promise.all([
			app.daoById(id),
			app.proposals(),
			app.accounts()
		]);
		if (!found.members.includes(me)) throw error(403, 'Only members can see this DAO');
		return {
			...found,
			proposals: proposals.filter((p) => p.daoId === found.id),
			names: Object.fromEntries(names.map((a) => [a.party, a.name]))
		};
	})
);

export const proposal = query.live(contractId, (id) =>
	live(async () => {
		const me = session.required();
		const [found, names] = await Promise.all([app.proposalById(id), app.accounts()]);
		if (!found.members.includes(me)) throw error(403, 'Only members can see this proposal');
		// The DAO's admin may cancel. Proposals from before 0.1.4 do not carry it, and a proposal
		// can outlive a deleted DAO, so this may be absent.
		const admin =
			found.admin ??
			(await app.daoById(found.daoId).then(
				(d) => d.admin,
				() => null
			));
		return { ...found, admin, names: Object.fromEntries(names.map((a) => [a.party, a.name])) };
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
		members: v.pipe(v.array(partyId), v.maxLength(50)),
		id: v.pipe(v.string(), v.uuid())
	}),
	async ({ party, daoName, description, members, id }) => {
		session.required(party);
		const account = await app.accountOf(party);
		const known = await app.accounts();
		for (const m of members) {
			if (!known.some((a) => a.party === m))
				throw error(404, `${m} is not registered with the app`);
		}
		if ((await app.daos()).some((d) => d.id === id)) throw error(409, 'That DAO id is taken');

		return participant.prepare(
			party,
			exercise(Main.Account.templateId, account.contractId, 'Account_CreateDAO', {
				daoName,
				description,
				members,
				id
			})
		);
	}
);

export const prepareCreateProposal = command(
	v.object({
		party: partyId,
		dao: contractId,
		proposer: partyId,
		title: text(120),
		description: v.pipe(v.string(), v.maxLength(5000)),
		closesAt: v.pipe(v.string(), v.isoTimestamp()),
		id: v.pipe(v.string(), v.uuid())
	}),
	async ({ party, dao, proposer, title, description, closesAt, id }) => {
		session.required(party);
		if (proposer !== party) throw error(400, 'The proposer must be you');
		const found = await app.daoById(dao);
		if (!found.members.includes(party)) throw error(403, 'Only members can propose');

		// The browser picks the deadline and the id so it can check them before signing; the
		// server only keeps them within bounds and unique.
		const days = (new Date(closesAt).getTime() - Date.now()) / 86_400_000;
		if (!(days > 0.5 && days <= 31)) throw error(400, 'The voting period must be 1 to 30 days');
		if ((await app.proposals()).some((p) => p.id === id))
			throw error(409, 'That proposal id is taken');

		return participant.prepare(
			party,
			exercise(Main.DAO.templateId, dao, 'DAO_CreateProposal', {
				proposer,
				title,
				description,
				closesAt,
				id
			})
		);
	}
);

/** The browser names the contract it saw; if a vote replaced it meanwhile, say so. */
async function currentProposal(contractId: string) {
	const found = (await app.proposals()).find((p) => p.contractId === contractId);
	if (!found)
		throw error(409, 'This proposal changed while you were looking at it — reload and try again');
	return found;
}

export const prepareVote = command(
	v.object({ party: partyId, contractId, vote: v.picklist(['Yes', 'No']) }),
	async ({ party, contractId, vote }) => {
		session.required(party);
		const current = await currentProposal(contractId);
		return participant.prepare(
			party,
			exercise(Main.Proposal.templateId, current.contractId, 'Proposal_Vote', {
				voter: party,
				vote
			})
		);
	}
);

/** The DAO contract the browser saw, if it is still the current one and the caller is admin. */
async function adminOf(contractId: string, party: string) {
	const found = await app.currentDao(contractId);
	if (found.admin !== party) throw error(403, 'Only the admin can do this');
	return found;
}

export const prepareUpdateDao = command(
	v.object({
		party: partyId,
		dao: contractId,
		daoName: text(60),
		description: v.pipe(v.string(), v.maxLength(2000)),
		members: v.pipe(v.array(partyId), v.maxLength(50))
	}),
	async ({ party, dao, daoName, description, members }) => {
		session.required(party);
		await adminOf(dao, party);
		const known = await app.accounts();
		for (const m of members) {
			if (!known.some((a) => a.party === m))
				throw error(404, `${m} is not registered with the app`);
		}
		return participant.prepare(
			party,
			exercise(Main.DAO.templateId, dao, 'DAO_Update', { daoName, description, members })
		);
	}
);

/** Deleting archives the DAO. Its settled proposals stay readable; open ones block it. */
export const prepareArchiveDao = command(
	v.object({ party: partyId, dao: contractId }),
	async ({ party, dao }) => {
		session.required(party);
		const found = await adminOf(dao, party);
		const open = (await app.proposals()).filter((p) => p.daoId === found.id && !p.outcome);
		if (open.length > 0) throw error(409, 'Close or cancel the open proposals first');
		return participant.prepare(party, exercise(Main.DAO.templateId, dao, 'DAO_Archive', {}));
	}
);

export const prepareUpdateProposal = command(
	v.object({
		party: partyId,
		contractId,
		title: text(120),
		description: v.pipe(v.string(), v.maxLength(5000))
	}),
	async ({ party, contractId, title, description }) => {
		session.required(party);
		const current = await currentProposal(contractId);
		if (current.proposer !== party) throw error(403, 'Only the proposer can edit');
		if (current.ballots.length > 0) throw error(409, 'Voting has started');
		return participant.prepare(
			party,
			exercise(Main.Proposal.templateId, current.contractId, 'Proposal_Update', {
				title,
				description
			})
		);
	}
);

export const prepareCancelProposal = command(
	v.object({ party: partyId, contractId }),
	async ({ party, contractId }) => {
		session.required(party);
		const current = await currentProposal(contractId);
		if (current.outcome) throw error(409, 'Already settled');
		if (current.proposer !== party) {
			const admin =
				current.admin ??
				(await app.daoById(current.daoId).then(
					(d) => d.admin,
					() => null
				));
			if (admin !== party) throw error(403, 'Only the proposer or the DAO admin can cancel');
		}
		return participant.prepare(
			party,
			exercise(Main.Proposal.templateId, current.contractId, 'Proposal_Cancel', {
				canceller: party
			})
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
