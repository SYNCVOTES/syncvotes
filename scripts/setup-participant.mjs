// Sets a fresh validator up for this app, once per network; run inside the app image with the
// validator backend's client secret, before the app is started for the first time:
//
//   docker compose --env-file <net>.env run --rm --no-deps \
//     -e VALIDATOR_CLIENT_SECRET=<KC_VALIDATOR_SECRET> app node scripts/setup-participant.mjs
//
// As the validator's ledger admin it makes the app's ledger user, allocates the operator party
// if none stands, and grants the app user what README "Authentication" lists. It prints the
// two party ids for the env file. Every step is idempotent.
const env = process.env;
const need = (k) => {
	if (!env[k]) throw new Error(`${k} is not set`);
	return env[k];
};
const LEDGER = need('LEDGER_API_URL');
const AUTH_URL = need('LEDGER_AUTH_URL');
const APP_USER = need('KC_APP_USER_ID');
const OPERATOR_HINT = env.OPERATOR_HINT ?? 'syncvotes-operator';
const PROVIDER_HINT = need('WALLET_USER_NAME');

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

// Parties this participant hosts, by hint.
async function localParties() {
	const out = [];
	let pageToken;
	do {
		const page = await api(
			`/v2/parties?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
		);
		for (const p of page.partyDetails) if (p.isLocal) out.push(p.party);
		pageToken = page.nextPageToken || undefined;
	} while (pageToken);
	return out;
}
const parties = await localParties();
const provider = parties.find((p) => p.split('::')[0] === PROVIDER_HINT);
if (!provider)
	throw new Error(`No hosted party with hint ${PROVIDER_HINT}; is the validator onboarded?`);
let operator = parties.find((p) => p.split('::')[0] === OPERATOR_HINT);
if (!operator) {
	const sync = (
		await api(`/v2/state/connected-synchronizers?party=${encodeURIComponent(provider)}`)
	).connectedSynchronizers[0].synchronizerId;
	const r = await api('/v2/parties', {
		partyIdHint: OPERATOR_HINT,
		identityProviderId: '',
		synchronizerId: sync,
		userId: ''
	});
	operator = r.partyDetails.party;
	console.log(`Operator party allocated: ${operator}`);
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
	{ kind: { CanReadAs: { value: { party: operator } } } },
	{ kind: { CanActAs: { value: { party: provider } } } }
];
await api(`/v2/users/${encodeURIComponent(APP_USER)}/rights`, {
	userId: APP_USER,
	identityProviderId: '',
	rights
});
console.log(
	`App user ${APP_USER} holds: ParticipantAdmin, CanReadAsAnyParty, CanExecuteAsAnyParty, CanReadAs operator, CanActAs provider`
);
console.log('');
console.log(`PROVIDER_PARTY=${provider}`);
console.log(`OPERATOR_PARTY=${operator}`);
