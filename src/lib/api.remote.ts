import { error } from '@sveltejs/kit';
import { command, query } from '$app/server';
import * as v from 'valibot';
import { Main } from '@daml.js/model';
import * as participant from './server/participant';
import { directory, entryFor, normaliseName, PARTY_HINT, register } from './server/app';

/**
 * The server's API, as remote functions: the page calls these like local functions, SvelteKit
 * does the transport. Everything here runs on the server with the participant credentials; the
 * user's key stays in the browser and only ever contributes signatures.
 */

const base64 = v.pipe(v.string(), v.nonEmpty(), v.base64());
const partyId = v.pipe(v.string(), v.includes('::'));

/**
 * Who is this key? The participant derives the party id from it. If that party already exists
 * the user is returning; otherwise the result carries what the key has to sign to create it.
 */
export const lookup = query(base64, async (publicKey) => {
	const topology = await participant.generateTopology(PARTY_HINT, publicKey);
	const exists = await participant.partyExists(topology.partyId);
	const name = exists
		? ((await directory()).find((e) => e.party === topology.partyId)?.name ?? null)
		: null;

	return { ...topology, exists, name };
});

/** The key signed its topology: create the party and register its name. */
export const enrol = command(
	v.object({ publicKey: base64, multiHash: base64, signature: base64, name: v.string() }),
	async ({ publicKey, multiHash, signature, name }) => {
		const chosen = normaliseName(name);

		// The SDK checks whether the party exists before allocating, so a returning key that never
		// finished registering lands here too and just gets its name.
		const { partyId } = await participant.allocateExternal(
			PARTY_HINT,
			publicKey,
			multiHash,
			signature
		);

		const entry = await register(partyId, chosen);
		return { party: entry.party, name: entry.name };
	}
);

type AssetPayload = { issuer: string; owner: string; name: string };

/** What a party can see, plus the directory so the page can show names instead of party ids. */
export const listAssets = query(partyId, async (party) => {
	const [assets, entries] = await Promise.all([
		participant.activeContracts<AssetPayload>(party, Main.Asset.templateId),
		directory()
	]);

	return {
		assets,
		directory: entries.map(({ party, name }) => ({ party, name }))
	};
});

/**
 * Turns an intent into a transaction the user's key can sign. Every action goes through the
 * user's proxy, which is what puts the provider among the confirmers.
 */
export const prepare = command(
	v.object({
		party: partyId,
		intent: v.variant('kind', [
			v.object({ kind: v.literal('issue'), name: v.pipe(v.string(), v.trim(), v.nonEmpty()) }),
			v.object({ kind: v.literal('give'), contractId: v.string(), to: v.string() })
		])
	}),
	async ({ party, intent }) => {
		const proxy = await entryFor(party);

		let choice: string;
		let choiceArgument: unknown;

		if (intent.kind === 'give') {
			const to = normaliseName(intent.to);
			const recipient = (await directory()).find((e) => e.name === to);
			if (!recipient) throw error(404, `Nobody is registered as "${to}"`);

			choice = 'AppProxy_Give';
			choiceArgument = { assetId: intent.contractId, newOwner: recipient.party };
		} else {
			choice = 'AppProxy_Issue';
			choiceArgument = { name: intent.name };
		}

		return participant.prepare(party, [
			{
				ExerciseCommand: {
					templateId: Main.AppProxy.templateId,
					contractId: proxy.contractId,
					choice,
					choiceArgument
				}
			}
		]);
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
