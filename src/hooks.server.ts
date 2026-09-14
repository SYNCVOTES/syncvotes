import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ServerInit } from '@sveltejs/kit';
import { packageId } from '@daml.js/model';
import { sdk } from '$lib/server/participant';

/**
 * The app ships with the Daml package it was built against and makes sure the participant has it
 * before serving a single request. Uploading is idempotent — the SDK checks by package id first —
 * so this is free on every start after the first, and a new package version lands together with
 * the code that needs it. If the participant is not up yet the process exits and the container
 * restarts into another attempt.
 */

/** In the image the DAR is at `dar/`; in development it is where `dpm build` left it. */
const DAR_DIRS = ['dar', 'daml/.daml/dist'];

async function findDar(): Promise<string> {
	for (const dir of DAR_DIRS) {
		const dar = (await readdir(dir).catch(() => []))
			.filter((f) => f.endsWith('.dar'))
			.map((f) => join(dir, f));
		if (dar.length === 1) return dar[0];
		if (dar.length > 1) throw new Error(`Several DARs in ${dir}: ${dar.join(', ')}`);
	}
	throw new Error(`No DAR found in ${DAR_DIRS.join(' or ')} — run pnpm daml:build`);
}

export const init: ServerInit = async () => {
	const dar = await findDar();
	await (await sdk()).ledger.dar.upload(await readFile(dar), packageId);
	console.log(`Daml package ${packageId.slice(0, 8)}… is on the participant (${dar})`);
};
