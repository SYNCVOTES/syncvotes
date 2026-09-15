import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HandleServerError, ServerInit } from '@sveltejs/kit';
import { packageId } from '@daml.js/model';
import { sdk } from '$lib/server/participant';
import { startFeed } from '$lib/server/feed';

/**
 * The app ships with the Daml package it was built against and makes sure the participant has it
 * before serving a single request. Uploading is idempotent — the SDK checks by package id first —
 * so this is free on every start after the first, and a new package version lands together with
 * the code that needs it. If the participant is not up yet the process exits and the container
 * restarts into another attempt.
 */

/** The Dockerfile puts the DAR it built at `dar/`. */
const DAR_DIR = 'dar';

async function findDar(): Promise<string> {
	const dar = (await readdir(DAR_DIR).catch(() => []))
		.filter((f) => f.endsWith('.dar'))
		.map((f) => join(DAR_DIR, f));
	if (dar.length !== 1) throw new Error(`Expected one DAR in ${DAR_DIR}, found ${dar.length}`);
	return dar[0];
}

export const init: ServerInit = async () => {
	const dar = await findDar();
	await (await sdk()).ledger.dar.upload(await readFile(dar), packageId);
	console.log(`Daml package ${packageId.slice(0, 8)}… is on the participant (${dar})`);
	startFeed();
};

/** An unexpected error still tells the user what happened; there is nothing secret in these. */
export const handleError: HandleServerError = ({ error }) => ({
	message: error instanceof Error ? error.message : 'Something went wrong'
});
