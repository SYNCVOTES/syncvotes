import * as v from 'valibot';

/**
 * What each field accepts, in one place: the browser checks a form against these before it
 * submits (`preflight`), and the server checks the same schema again before it prepares
 * anything. Messages are what the user reads under the field.
 */

const trimmed = (label: string, min: number, max: number) =>
	v.pipe(
		v.string(`${label} is required`),
		v.trim(),
		v.minLength(min, `${label} needs at least ${min} characters`),
		v.maxLength(max, `${label} is at most ${max} characters`)
	);

export const daoName = trimmed('The name', 2, 60);
export const daoDescription = v.pipe(
	v.string(),
	v.maxLength(2000, 'The description is at most 2000 characters')
);
export const proposalTitle = trimmed('The title', 2, 120);
export const proposalDescription = v.pipe(
	v.string(),
	v.maxLength(5000, 'The description is at most 5000 characters')
);
export const votingDays = v.pipe(
	v.number('The voting period is a number of days'),
	v.integer('Whole days only'),
	v.minValue(1, 'At least one day'),
	v.maxValue(30, 'At most thirty days')
);
export const id = v.pipe(v.string(), v.nonEmpty());
export const partyId = v.pipe(v.string(), v.includes('::'), v.maxLength(300));

/** Members added or removed per transaction; longer lists are split. */
export const BATCH = 200;

/** Party ids as a chips field submits them: separated by whitespace, in the order typed. */
export const partyList = (max = BATCH) =>
	v.pipe(
		v.optional(v.string(), ''),
		v.transform((s) => [...new Set(s.split(/\s+/).filter((t) => t.includes('::')))]),
		v.maxLength(max, `At most ${max} parties at once`)
	);

export const createDaoForm = v.object({
	daoName,
	description: daoDescription,
	members: partyList(BATCH - 1)
});
export const updateDaoForm = v.object({ dao: id, daoName, description: daoDescription });

export const effectKind = v.picklist(['signal', 'members']);

export const createProposalForm = v.pipe(
	v.object({
		dao: id,
		title: proposalTitle,
		description: proposalDescription,
		days: votingDays,
		kind: effectKind,
		add: partyList(),
		remove: partyList()
	}),
	v.forward(
		v.check(
			(f) => f.kind !== 'members' || f.add.length + f.remove.length > 0,
			'Name someone to add or remove'
		),
		['add']
	)
);
