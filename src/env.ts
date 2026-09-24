import { defineEnvVars } from '@sveltejs/kit/env';
import { building } from '$app/env';
import * as v from 'valibot';

/**
 * All but NETWORK and NETWORKS are private: only the server reads them, and `$app/env/private` cannot be
 * imported in the browser.
 *
 * Values are read at startup rather than inlined at build time, so one image can run against
 * different participants. Hence they are optional while building and required when the app
 * starts: better to refuse to boot with a half-configured environment than to fail on the first
 * request to the participant.
 */
const required = building ? v.optional(v.string()) : v.pipe(v.string(), v.nonEmpty());

export const variables = defineEnvVars({
	LEDGER_API_URL: {
		description: "The participant's JSON Ledger API, e.g. http://nginx with a json-ledger-api host",
		schema: required
	},
	PROVIDER_PARTY: {
		description:
			'The app provider party: signs every contract a user acts on, so it confirms and earns',
		schema: required
	},
	PAYEE_PARTY: {
		description:
			"Where users pay in by memo: the validator's own party, whose wallet buys the traffic. Empty: the provider",
		schema: v.optional(v.string(), '')
	},
	PAYEE_SINCE: {
		description:
			"When the payee started taking the app's payments (ISO time): its earlier memos were someone else's, or already counted",
		schema: v.optional(v.string(), '')
	},
	LEDGER_AUTH_URL: {
		description: "The identity provider's OpenID discovery document",
		schema: required
	},
	LEDGER_AUTH_CLIENT_ID: {
		description: 'This app as an OAuth client of the identity provider',
		schema: required
	},
	LEDGER_AUTH_CLIENT_SECRET: {
		description: "That client's secret",
		schema: required
	},
	LEDGER_AUTH_AUDIENCE: {
		description: 'Audience the participant expects in ledger tokens',
		schema: required
	},
	LEDGER_AUTH_SCOPE: {
		description: 'Scope to request for ledger tokens',
		schema: v.optional(v.string(), 'daml_ledger_api')
	},
	SCAN_URL: {
		description: "The network's public Scan: Canton Coin rules, rounds and prices, no token needed",
		schema: required
	},
	BILLING_FACTOR: {
		description:
			'A multiple of the net cost of traffic (its price less the rewards it earns) a payer is charged; below one subsidises',
		schema: v.optional(v.string(), '1')
	},
	INVITE_CODES: {
		description:
			'Invite codes, comma-separated; while any are set, a new party needs one. Empty: open to all',
		schema: v.optional(v.string(), '')
	},
	NETWORK: {
		description:
			'The Canton network this deployment is on, as shown to users: DevNet, TestNet or MainNet',
		public: true,
		schema: v.optional(v.picklist(['DevNet', 'TestNet', 'MainNet']), 'TestNet')
	},
	NETWORKS: {
		description:
			'The deployments to switch to, as Name=URL pairs, comma-separated (MainNet=https://…,TestNet=https://…). Empty: no switcher',
		public: true,
		schema: v.optional(v.string(), '')
	},
	GIT_SHA: {
		description: 'The commit this image was built from, baked in by the Dockerfile',
		schema: v.optional(v.string(), 'unknown')
	}
});
