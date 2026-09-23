import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HandleServerError, ServerInit } from '@sveltejs/kit';
import { packageId } from '@daml.js/model';
import { api, sdk } from '$lib/server/participant';
import * as ledger from '$lib/server/ledger';
import * as tally from '$lib/server/tally';
import * as billing from '$lib/server/billing';

// Where the Dockerfile puts the DAR it built.
const DAR_DIR = 'dar';

/**
 * The app ships with the Daml package it was built against and puts it on the participant
 * before serving a request — idempotent by package id, so free on every start but the first.
 * If the participant is not up yet the process exits and the container restarts into another
 * attempt.
 */
export const init: ServerInit = async () => {
	const dars = (await readdir(DAR_DIR)).filter((f) => f.endsWith('.dar'));
	if (dars.length !== 1) throw new Error(`Expected one DAR in ${DAR_DIR}, found ${dars.length}`);
	await (await sdk()).ledger.dar.upload(await readFile(join(DAR_DIR, dars[0])), packageId);
	// The SDK logs a refusal (a package that is no valid upgrade of its namesake) and resolves
	// all the same; the participant's own list is what says the package is there.
	const { packageIds } = await api<{ packageIds: string[] }>('/v2/packages');
	if (!packageIds.includes(packageId)) {
		throw new Error(
			`Daml package ${packageId.slice(0, 8)}… (${dars[0]}) was refused by the participant; see the log above`
		);
	}
	console.log(`Daml package ${packageId.slice(0, 8)}… is on the participant (${dars[0]})`);
	// No request is answered before the ledger copy exists: a page asking during the load
	// would be told its DAO does not exist.
	ledger.start();
	await ledger.ready();
	tally.start();
	billing.start();
};

/** An unexpected error still tells the user what happened; there is nothing secret in these. */
export const handleError: HandleServerError = ({ error }) => ({
	message: error instanceof Error ? error.message : 'Something went wrong'
});
