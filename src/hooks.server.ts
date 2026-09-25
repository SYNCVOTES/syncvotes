import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redirect, type Handle, type HandleServerError, type ServerInit } from '@sveltejs/kit';
import { building } from '$app/env';
import { packageId } from '@daml.js/model';
import { api, readHostedParties, sdk } from '$lib/server/participant';
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
	// Prerendering the docs runs the server during the build, with no participant to talk to.
	if (building) return;
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
	// The participant's party list is the whole network's: read once, in the background, so a key
	// that comes back without an Account is found in the index rather than by a scan per visit.
	void readHostedParties().catch((e) => console.error('The hosted parties could not be read:', e));
};

/**
 * An unexpected error is logged in full and shown by a reference only: its text can carry
 * internal addresses and contract ids. What the ledger refuses reaches the user as an expected
 * error (`ledgerError`), with its reason.
 */
export const handleError: HandleServerError = ({ error }) => {
	const ref = crypto.randomUUID().slice(0, 8);
	console.error(`Unexpected error ${ref}:`, error);
	return { message: `Something went wrong (ref ${ref}). Try again.` };
};

/** Where the app lived before it moved under /app: links already shared keep working. */
const MOVED = /^\/(my-daos|daos|proposals|people|wallet)(\/|$)/;

export const handle: Handle = ({ event, resolve }) => {
	// The query is read only for a moved path: prerendered pages may not touch it.
	const { pathname } = event.url;
	if (MOVED.test(pathname)) redirect(308, `/app${pathname}${event.url.search}`);
	return resolve(event);
};
