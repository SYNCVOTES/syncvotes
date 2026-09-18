import { defineEnvVars } from '@sveltejs/kit/env';
import { building } from '$app/env';
import * as v from 'valibot';

/**
 * All but NETWORK are private: only the server reads them, and `$app/env/private` cannot be
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
		description: 'The app provider party: holds the FeaturedAppRight, signs the proxy, earns',
		schema: required
	},
	OPERATOR_PARTY: {
		description:
			"The backend's own party: observer on every proxy, reads the directory, never earns",
		schema: required
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
	VALIDATOR_API_URL: {
		description: "This app's validator API, e.g. http://validator:5003/api/validator",
		schema: required
	},
	VALIDATOR_AUTH_CLIENT_ID: {
		description: "The validator backend's own OAuth client: its admin endpoints answer to it alone",
		schema: required
	},
	VALIDATOR_AUTH_CLIENT_SECRET: {
		description: "That client's secret",
		schema: required
	},
	BILLING_FACTOR: {
		description: 'What a DAO pays per byte of traffic, as a multiple of the network price',
		schema: v.optional(v.string(), '1')
	},
	NETWORK: {
		description: 'The Canton network this deployment is on, as shown to users: TestNet or MainNet',
		public: true,
		schema: v.optional(v.picklist(['TestNet', 'MainNet']), 'TestNet')
	},
	GIT_SHA: {
		description: 'The commit this image was built from, baked in by the Dockerfile',
		schema: v.optional(v.string(), 'unknown')
	}
});
