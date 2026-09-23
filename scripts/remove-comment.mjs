// Takes a comment down with the DAO's authority, run by hand inside the app container:
//   docker compose exec app node scripts/remove-comment.mjs <comment contract id>
// The ledger records that this DAO's comment went; the page shows the thread without it.
import { SDK } from '@canton-network/wallet-sdk';

const [cid] = process.argv.slice(2);
if (!cid) {
	console.error('Usage: node scripts/remove-comment.mjs <comment contract id>');
	process.exit(2);
}
const env = process.env;
const auth = {
	method: 'client_credentials',
	configUrl: env.LEDGER_AUTH_URL,
	credentials: {
		clientId: env.LEDGER_AUTH_CLIENT_ID,
		clientSecret: env.LEDGER_AUTH_CLIENT_SECRET,
		audience: env.LEDGER_AUTH_AUDIENCE,
		scope: env.LEDGER_AUTH_SCOPE
	}
};
const sdk = await SDK.create({
	ledgerClientUrl: env.LEDGER_API_URL,
	auth,
	logAdapter: { log() {} }
});

async function token() {
	const cfg = await (await fetch(env.LEDGER_AUTH_URL)).json();
	const body = new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: env.LEDGER_AUTH_CLIENT_ID,
		client_secret: env.LEDGER_AUTH_CLIENT_SECRET,
		scope: env.LEDGER_AUTH_SCOPE
	});
	const r = await (await fetch(cfg.token_endpoint, { method: 'POST', body })).json();
	return r.access_token;
}
/** The provider's active contracts of one template. */
async function active(templateId) {
	const activeAtOffset = await sdk.ledger.ledgerEnd();
	const r = await fetch(env.LEDGER_API_URL + '/v2/state/active-contracts', {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (await token()) },
		body: JSON.stringify({
			filter: {
				filtersByParty: {
					[env.PROVIDER_PARTY]: {
						cumulative: [{ identifierFilter: { TemplateFilter: { value: { templateId } } } }]
					}
				}
			},
			verbose: false,
			activeAtOffset
		})
	});
	if (!r.ok) throw new Error(`active-contracts ${r.status}: ${(await r.text()).slice(0, 300)}`);
	return (await r.json())
		.map((e) => e.contractEntry?.JsActiveContract?.createdEvent)
		.filter(Boolean);
}

const comment = (await active('#syncvotes-books:Main:Comment')).find((c) => c.contractId === cid);
if (!comment) {
	console.error('No such comment among the active ones');
	process.exit(1);
}
const dao = (await active('#syncvotes-books:Main:DAO')).find(
	(d) => d.createArgument.id === comment.createArgument.daoId
);
if (!dao) {
	console.error('The comment belongs to a DAO that is gone');
	process.exit(1);
}
const { updateId } = await sdk.ledger.internal.submit({
	commands: [
		{
			ExerciseCommand: {
				templateId: '#syncvotes-books:Main:DAO',
				contractId: dao.contractId,
				choice: 'DAO_RemoveComment',
				choiceArgument: { comment: cid }
			}
		}
	],
	actAs: [env.PROVIDER_PARTY],
	commandId: `remove-comment-${cid.slice(0, 16)}`
});
console.log(`Comment ${cid.slice(0, 12)}… of DAO ${dao.createArgument.id} removed in ${updateId}`);
process.exit(0);
