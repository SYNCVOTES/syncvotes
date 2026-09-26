// Sets a fresh validator up for this app, once per network; run inside the app image with the
// validator backend's client secret, before the app is started for the first time:
//
//   VALIDATOR_CLIENT_SECRET=$(grep ^KC_VALIDATOR_SECRET= <net>.env | cut -d= -f2-) \
//     docker compose --env-file <net>.env run --rm --no-deps -e VALIDATOR_CLIENT_SECRET \
//     app node scripts/setup-participant.mjs
//
// (`-e NAME` without a value passes it from the environment, so the secret stays out of the
// command line and the shell history.)
//
// As the validator's ledger admin it allocates the app's own provider party
// (syncvotes-app-provider, not the validator's party: rewards and the coin paid in by memo belong
// to the app), makes the app's ledger user and grants it what README "Run your own" lists. It
// prints the provider party id for the env file. Every step is idempotent. The provider then
// needs some coin, sent from any wallet, for its transfer pre-approval.
const env = process.env;
const need = (k) => {
	if (!env[k]) throw new Error(`${k} is not set`);
	return env[k];
};
const LEDGER = need('LEDGER_API_URL');
const AUTH_URL = need('LEDGER_AUTH_URL');
const APP_USER = need('KC_APP_USER_ID');
const PROVIDER_HINT = env.PROVIDER_HINT ?? 'syncvotes-app-provider';
// The validator's own party, onboarded before this runs: where the synchronizer is found.
const VALIDATOR_HINT = need('WALLET_USER_NAME');

async function token(clientId, secret) {
	const cfg = await (await fetch(AUTH_URL)).json();
	const body = new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: clientId,
		client_secret: secret,
		scope: env.LEDGER_AUTH_SCOPE ?? 'daml_ledger_api'
	});
	const r = await fetch(cfg.token_endpoint, { method: 'POST', body });
	if (!r.ok)
		throw new Error(`token for ${clientId}: ${r.status} ${(await r.text()).slice(0, 200)}`);
	return (await r.json()).access_token;
}
// Where the participant does not trust our realm yet (MainNet, HMAC for the validator's own
// backend), an admin token minted elsewhere is passed in as ADMIN_TOKEN instead.
const admin =
	env.ADMIN_TOKEN ?? (await token('validator-app-backend', need('VALIDATOR_CLIENT_SECRET')));
async function api(path, body, method = body ? 'POST' : 'GET') {
	const r = await fetch(LEDGER + path, {
		method,
		headers: { 'content-type': 'application/json', authorization: `Bearer ${admin}` },
		body: body ? JSON.stringify(body) : undefined
	});
	const text = await r.text();
	if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${text.slice(0, 400)}`);
	return text ? JSON.parse(text) : undefined;
}

// Parties allocated here live in the participant's own namespace, so their ids are known from
// their hints; nothing has to walk the network's party list.
const namespace = (await api('/v2/parties/participant-id')).participantId.split('::')[1];
const hosted = (party) =>
	api(`/v2/parties/${encodeURIComponent(party)}`).then(
		(r) => !!r.partyDetails?.[0]?.isLocal,
		() => false
	);
const validator = `${VALIDATOR_HINT}::${namespace}`;
if (!(await hosted(validator)))
	throw new Error(`No hosted party ${validator}; is the validator onboarded?`);
let provider = `${PROVIDER_HINT}::${namespace}`;
if (!(await hosted(provider))) {
	const sync = (
		await api(`/v2/state/connected-synchronizers?party=${encodeURIComponent(validator)}`)
	).connectedSynchronizers[0].synchronizerId;
	const r = await api('/v2/parties', {
		partyIdHint: PROVIDER_HINT,
		identityProviderId: '',
		synchronizerId: sync,
		userId: '',
		localMetadata: { resourceVersion: '', annotations: { app: 'syncvotes', role: 'app-provider' } }
	});
	provider = r.partyDetails.party;
	console.log(`Provider party allocated: ${provider}`);
}

// The app's ledger user: made if missing, then given its rights.
const exists = await api(`/v2/users/${encodeURIComponent(APP_USER)}`).then(
	() => true,
	() => false
);
if (!exists) {
	await api('/v2/users', {
		user: {
			id: APP_USER,
			primaryParty: '',
			isDeactivated: false,
			identityProviderId: '',
			metadata: { resourceVersion: '', annotations: {} }
		},
		rights: []
	});
	console.log(`App user ${APP_USER} created`);
}
const rights = [
	{ kind: { ParticipantAdmin: { value: {} } } },
	{ kind: { CanReadAsAnyParty: { value: {} } } },
	{ kind: { CanExecuteAsAnyParty: { value: {} } } },
	{ kind: { CanActAs: { value: { party: provider } } } }
];
await api(`/v2/users/${encodeURIComponent(APP_USER)}/rights`, {
	userId: APP_USER,
	identityProviderId: '',
	rights
});
console.log(
	`App user ${APP_USER} holds: ParticipantAdmin, CanReadAsAnyParty, CanExecuteAsAnyParty, CanActAs provider`
);
console.log('');
console.log(`PROVIDER_PARTY=${provider}`);
