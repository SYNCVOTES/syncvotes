import type { Main } from '@daml.js/model';
import * as remote from './api.remote';
import { toBase64, type Signer } from './wallet';
import { verifyPrepared, verifyTopology } from './verify';

/**
 * The browser's half of every ledger operation. The server prepares transactions; this file
 * checks what comes back against what was asked for (`verify.ts`), has the signer sign it and
 * sends it on. The key itself never leaves its closure in `wallet.ts`.
 */

export type AssetContract = { contractId: string; payload: Main.Asset };
export type Entry = { party: string; name: string };
export type Identity = { party: string; name: string };
export type Topology = Awaited<ReturnType<typeof remote.lookup>>;

/** Which party this key is, and whether it already exists on the ledger. */
export const lookup = (s: Signer): Promise<Topology> => remote.lookup(toBase64(s.publicKey));

/** Creates the party for a new key. The key signs its own topology; the server only forwards. */
export async function enrol(s: Signer, topology: Topology, name: string): Promise<Identity> {
	await verifyTopology(topology);

	const { party } = await remote.enrol({
		publicKey: toBase64(s.publicKey),
		multiHash: topology.multiHash,
		signature: s.sign(topology.multiHash),
		name
	});
	return { party, name };
}

/** Always fresh: queries are cached per argument, and the ledger moves underneath them. */
export async function listAssets(party: string) {
	const listing = remote.listAssets(party);
	await listing.refresh();
	return listing;
}

/** The Daml choice each intent must turn into; anything else is refused before signing. */
const CHOICE = { issue: 'AppProxy_Issue', give: 'AppProxy_Give' } as const;

/** Prepare on the server, verify and sign here, execute on the server — which waits for completion. */
async function transact(
	s: Signer,
	who: Identity,
	intent: Parameters<typeof remote.prepare>[0]['intent']
): Promise<void> {
	const prepared = await remote.prepare({ party: who.party, intent });
	await verifyPrepared(prepared, { party: who.party, choice: CHOICE[intent.kind] });

	await remote.execute({
		party: who.party,
		...prepared,
		signature: s.sign(prepared.preparedTransactionHash)
	});
}

export const issueAsset = (s: Signer, who: Identity, name: string) =>
	transact(s, who, { kind: 'issue', name });

export const giveAsset = (s: Signer, who: Identity, contractId: string, to: string) =>
	transact(s, who, { kind: 'give', contractId, to });

export type Listing = { assets: AssetContract[]; directory: Entry[] };
