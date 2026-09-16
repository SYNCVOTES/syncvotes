/**
 * Names are what users type to reach each other, so they are short and unambiguous: lower-case
 * letters, digits and dashes. The same rule runs in the browser, so people see the name they
 * will actually get before they sign for it, and on the server, which is the one that counts.
 */
export const NAME_MAX = 30;

export const normaliseName = (input: string): string =>
	input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');

export const nameProblem = (name: string): string | null =>
	name.length < 2
		? 'A name needs at least two letters or digits'
		: name.length > NAME_MAX
			? `A name is at most ${NAME_MAX} characters`
			: null;
