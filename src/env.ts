import { defineEnvVars } from '@sveltejs/kit/env';
import { building } from '$app/env';
import * as v from 'valibot';

/**
 * All of these are private: only the server endpoint that hands out proxy contracts reads them.
 * They never reach the browser — `$app/env/private` cannot be imported there.
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
	LEDGER_USER_ID: {
		description: 'The ledger user the server submits commands as',
		schema: required
	},
	LEDGER_AUTH_AUDIENCE: {
		description: "Audience for the participant's token",
		schema: required
	},
	LEDGER_AUTH_SECRET: {
		description: 'Token signing secret; `unsafe` on a validator running dev-mode auth',
		schema: required
	},
	GIT_SHA: {
		description: 'The commit this image was built from, baked in by the Dockerfile',
		schema: v.optional(v.string(), 'unknown')
	}
});
