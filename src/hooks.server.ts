import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HandleValidationError, HandleServerError, ServerInit } from '@sveltejs/kit';
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

/**
 * A remote function's argument failed its schema. SvelteKit would answer "Bad Request"; say
 * which field and why — a pasted description over the limit is the usual case.
 */
export const handleValidationError: HandleValidationError = ({ issues }) => ({
	message: issues
		.map((issue) => {
			const field = issue.path
				?.map((p) => (typeof p === 'object' ? String(p.key) : String(p)))
				.join('.');
			const name = field ? field[0].toUpperCase() + field.slice(1) : 'Input';
			const tooLong = issue.message.match(/Expected <=(\d+) but received (\d+)/);
			return tooLong
				? `${name} is too long: ${tooLong[2]} characters, at most ${tooLong[1]} allowed`
				: `${name}: ${issue.message}`;
		})
		.join('; ')
});
