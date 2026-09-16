import type { RemoteForm, RemoteFormInput } from '@sveltejs/kit';
import * as v from 'valibot';
import * as actions from './actions';
import { store, flow, describe } from './wallet-store.svelte';

/**
 * Every text form works the same way: the browser checks the fields against the schema, the
 * server checks them again and prepares a transaction, the browser verifies that it says what
 * the fields say, signs it and executes it, then `then` runs. `intent` names the transaction
 * the fields ask for — from the fields as the schema normalises them (trimmed), never from the
 * server's reply, which is only trusted for what it alone knows, like a fresh id.
 */
export function signedForm<
	Input extends RemoteFormInput,
	Fields,
	Output extends { prepared: actions.Prepared }
>(
	f: RemoteForm<Input, Output>,
	schema: v.GenericSchema<Input, Fields>,
	intent: (fields: Fields, result: Output) => actions.Intent,
	then: (result: Output) => Promise<unknown> | unknown
) {
	return f.preflight(schema).enhance(async ({ submit }) => {
		try {
			await submit();
		} catch (e) {
			store.problem = describe(e);
			return;
		}
		const result = f.result;
		if (!result) return;
		const fields = v.parse(schema, f.fields.value());
		const ok = await flow.act((s, w) =>
			actions.sign(s, w, intent(fields, result), result.prepared)
		);
		if (ok) await then(result);
	});
}
