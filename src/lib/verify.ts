import {
	computeMultiHashForTopology,
	computeSha256CantonHash,
	decodePreparedTransaction,
	hashPreparedTransaction
} from '@canton-network/core-tx-visualizer';
import { fromBase64, toBase64 } from './wallet';

/**
 * What the key is about to sign, checked against what the server said it is.
 *
 * The server prepares transactions and hands back a hash; the key signs the hash. Without these
 * checks the browser would sign whatever hash it was given. With them, a hash is only signed if it
 * matches bytes the browser has decoded itself, those bytes exercise the choice the user asked
 * for on the template it belongs to, and the only authority the signature grants is the user's
 * own party.
 * The hashing is the same code the wallet SDK uses for its offline-signing flow.
 */

// Hash purposes from Canton's hashing scheme v2, as the SDK's `utils.hash.topologyTransaction`.
const TOPOLOGY_TRANSACTION = 11;
const TOPOLOGY_MULTI_HASH = 55;

/** The only choices a user is ever asked to sign, and the template each lives on. */
export const CHOICES: Record<string, string> = {
	Account_CreateDAO: 'Main:Account',
	DAO_CreateProposal: 'Main:DAO',
	Proposal_Vote: 'Main:Proposal',
	Proposal_Close: 'Main:Proposal'
};

export async function verifyTopology(topology: {
	topologyTransactions: string[];
	multiHash: string;
}): Promise<void> {
	const hashes = await Promise.all(
		topology.topologyTransactions.map((tx) =>
			computeSha256CantonHash(TOPOLOGY_TRANSACTION, fromBase64(tx))
		)
	);
	const combined = await computeMultiHashForTopology(hashes);
	const multiHash = toBase64(await computeSha256CantonHash(TOPOLOGY_MULTI_HASH, combined));

	if (multiHash !== topology.multiHash) {
		throw new Error('The party topology does not match the hash the server asked to sign');
	}
}

export async function verifyPrepared(
	prepared: { preparedTransaction: string; preparedTransactionHash: string },
	expected: { party: string; choice: string }
): Promise<void> {
	const hash = await hashPreparedTransaction(prepared.preparedTransaction, 'base64');
	if (hash !== prepared.preparedTransactionHash) {
		throw new Error('The transaction does not match the hash the server asked to sign');
	}

	const tx = decodePreparedTransaction(prepared.preparedTransaction);

	// The signature authorises exactly the submitter's actAs — so that must be the user, alone.
	const actAs = tx.metadata?.submitterInfo?.actAs ?? [];
	if (actAs.length !== 1 || actAs[0] !== expected.party) {
		throw new Error(`The transaction acts as ${actAs.join(', ') || 'nobody'}, not you`);
	}

	const nodes = tx.transaction?.nodes ?? [];
	const roots = tx.transaction?.roots ?? [];
	const byId = new Map(nodes.map((node) => [node.nodeId, node]));

	// One root, and it is the user exercising the asked-for choice on the right template. Whatever
	// hangs below it is the choice's own body, authorised by that contract's signatories, not by us.
	const root = roots.length === 1 ? byId.get(roots[0])?.versionedNode : undefined;
	if (root?.oneofKind !== 'v1' || root.v1.nodeType.oneofKind !== 'exercise') {
		throw new Error('Expected a single choice exercise, got something else');
	}

	const { choiceId, templateId, actingParties } = root.v1.nodeType.exercise;
	const template = `${templateId?.moduleName}:${templateId?.entityName}`;
	const home = CHOICES[expected.choice];
	if (!home || choiceId !== expected.choice || template !== home) {
		throw new Error(`Expected to sign ${expected.choice} on ${home}, got ${choiceId} on ${template}`);
	}
	if (actingParties.some((p) => p !== expected.party)) {
		throw new Error(`The choice would be exercised by ${actingParties.join(', ')}, not you`);
	}
}
