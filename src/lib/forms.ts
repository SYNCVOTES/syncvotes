import type { RemoteForm } from '@sveltejs/kit';
import * as actions from './actions';
import { store, flow, describe } from './wallet-store.svelte';

/**
 * Every text form works the same way: the browser checks the fields against the schema, the
 * server checks them again and prepares a transaction, the browser verifies and signs it, then
 * goes somewhere. This is that, once. `then` runs after the signed transaction landed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- typed against the form's own input by `preflight`
export function signedForm<Form extends RemoteForm<any, actions.FormResult>>(
	f: Form,
	schema: Parameters<Form['preflight']>[0],
	then: (result: NonNullable<Form['result']>) => Promise<unknown> | unknown
) {
	return f.preflight(schema).enhance(async ({ submit }) => {
		try {
			await submit();
		} catch (e) {
			store.problem = describe(e);
			return;
		}
		const r = f.result as NonNullable<Form['result']> | undefined;
		if (!r) return;
		const ok = await flow.act((s, w) => actions.signPrepared(s, w, r));
		if (ok) await then(r);
	});
}
