import { error } from '@sveltejs/kit';
import { command, query } from '$app/server';
import * as v from 'valibot';
import { Main } from '@daml.js/model';
import * as participant from './server/participant';
import * as app from './server/app';

/**
 * The server's API, as remote functions: the page calls these like local functions, SvelteKit
 * does the transport. Everything here runs on the server with the participant credentials; the
 * user's key stays in the browser and only ever contributes signatures.
 *
 * Reads are open: a DAO is private to the network — only its members, the provider and the
 * operator hold it — and this app is the operator. Writes are transactions the ledger accepts
 * only with the acting party's own signature.
 */

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
	const name = exists
		? ((await app.accounts()).find((a) => a.party === topology.partyId)?.name ?? null)
		: null;

	return { ...topology, exists, name };
});

/** The key signed its topology: create the party and register its name. */
export const enrol = command(
	v.object({ publicKey: base64, multiHash: base64, signature: base64, name: v.string() }),
	async ({ publicKey, multiHash, signature, name }) => {
		const chosen = app.normaliseName(name);

		// The SDK checks whether the party exists before allocating, so a returning key that never
		// finished registering lands here too and just gets its name.
		const { partyId } = await participant.allocateExternal(app.PARTY_HINT, publicKey, multiHash, signature);

		const account = await app.register(partyId, chosen);
		return { party: account.party, name: account.name };
	}
);

/** The directory: every registered name, for picking members. */
export const directory = query(async () =>
	(await app.accounts()).map(({ party, name }) => ({ party, name }))
);

// ---- Reads -------------------------------------------------------------------------------

/** The DAOs a party belongs to, with their open proposal count. */
export const myDaos = query(partyId, async (party) => {
	const [daos, proposals] = await Promise.all([app.daos(), app.proposals()]);
	return daos
		.filter((d) => d.members.includes(party))
		.map((d) => ({
			...d,
			openProposals: proposals.filter((p) => p.dao === d.contractId && !p.outcome).length
		}));
});

export const dao = query(contractId, async (id) => {
	const [found, proposals, names] = await Promise.all([app.daoById(id), app.proposals(), app.accounts()]);
	return {
		...found,
		proposals: proposals.filter((p) => p.dao === id),
		names: Object.fromEntries(names.map((a) => [a.party, a.name]))
	};
});

export const proposal = query(contractId, async (id) => {
	const [found, names] = await Promise.all([app.proposalById(id), app.accounts()]);
	return { ...found, names: Object.fromEntries(names.map((a) => [a.party, a.name])) };
});

// ---- Writes: prepare here, sign in the browser, execute here ------------------------------

const exercise = (templateId: string, contractId: string, choice: string, choiceArgument: unknown) => [
	{ ExerciseCommand: { templateId, contractId, choice, choiceArgument } }
];

export const prepareCreateDao = command(
	v.object({
		party: partyId,
		name: text(60),
		description: v.pipe(v.string(), v.trim(), v.maxLength(2000)),
		members: v.array(v.string())
	}),
	async ({ party, name, description, members }) => {
		const account = await app.accountOf(party);
		const known = await app.accounts();
		const resolved = members.map((m) => {
			const wanted = app.normaliseName(m);
			const found = known.find((a) => a.name === wanted);
			if (!found) throw error(404, `Nobody is registered as "${wanted}"`);
			return found.party;
		});

		return participant.prepare(
			party,
			exercise(Main.Account.templateId, account.contractId, 'Account_CreateDAO', {
				daoName: name,
				description,
				members: resolved
			})
		);
	}
);

export const prepareCreateProposal = command(
	v.object({
		party: partyId,
		dao: contractId,
		title: text(120),
		description: v.pipe(v.string(), v.trim(), v.maxLength(5000)),
		days: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(30))
	}),
	async ({ party, dao, title, description, days }) => {
		const found = await app.daoById(dao);
		if (!found.members.includes(party)) throw error(403, 'Only members can propose');

		const closesAt = new Date(Date.now() + days * 86_400_000).toISOString();
		return participant.prepare(
			party,
			exercise(Main.DAO.templateId, dao, 'DAO_CreateProposal', {
				proposer: party,
				title,
				description,
				closesAt
			})
		);
	}
);

export const prepareVote = command(
	v.object({ party: partyId, proposal: contractId, vote: v.picklist(['Yes', 'No']) }),
	async ({ party, proposal, vote }) =>
		participant.prepare(
			party,
			exercise(Main.Proposal.templateId, proposal, 'Proposal_Vote', { voter: party, vote })
		)
);

export const prepareClose = command(
	v.object({ party: partyId, proposal: contractId }),
	async ({ party, proposal }) =>
		participant.prepare(
			party,
			exercise(Main.Proposal.templateId, proposal, 'Proposal_Close', { closer: party })
		)
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
