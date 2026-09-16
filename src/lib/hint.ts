/**
 * The hint is the label in a party id (`alice::1220…`): lower-case letters, digits and dashes,
 * chosen once. The same rule runs in the browser, so people see the id they will actually get
 * before they sign for it, and on the server, which is the one that counts.
 */
export const HINT_MAX = 30;

export const normaliseHint = (input: string): string =>
	input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');

export const hintProblem = (hint: string): string | null =>
	hint.length < 2
		? 'A hint needs at least two letters or digits'
		: hint.length > HINT_MAX
			? `A hint is at most ${HINT_MAX} characters`
			: null;
