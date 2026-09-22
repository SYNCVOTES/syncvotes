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

/**
 * A share table as the table submits it: one `party=percent` per line. Percents have at most
 * two decimals and add up to exactly 100; the ledger checks the same.
 */
export const shareTable = v.pipe(
	v.string('Shares are required'),
	v.transform((raw) =>
		raw
			.split(/\n+/)
			.map((l) => l.trim())
			.filter(Boolean)
			.map((l) => {
				const [party, pct] = l.split('=');
				return { party: party.trim(), share: Math.round(Number(pct) * 100) / 100 };
			})
	),
	v.minLength(1, 'At least one holder'),
	v.maxLength(BATCH, `At most ${BATCH} holders at once`),
	v.check((rows) => rows.every((r) => r.party.includes('::')), 'A row has no party id'),
	v.check((rows) => rows.every((r) => r.share > 0), 'Every share must be more than zero'),
	v.check(
		(rows) => new Set(rows.map((r) => r.party)).size === rows.length,
		'A party is listed twice'
	),
	v.check(
		(rows) => Math.round(rows.reduce((s, r) => s + r.share, 0) * 100) === 10000,
		'The shares must add up to exactly 100%'
	)
);

export const createDaoForm = v.object({
	daoName,
	description: daoDescription,
	shares: shareTable
});

export const effectKind = v.picklist(['signal', 'shares', 'info', 'dissolve']);

export const createProposalForm = v.pipe(
	v.object({
		dao: id,
		title: proposalTitle,
		description: proposalDescription,
		days: votingDays,
		kind: effectKind,
		shares: v.optional(v.string(), ''),
		newName: v.optional(v.string(), ''),
		newDescription: v.optional(v.string(), ''),
		basis: v.picklist(['all', 'cast']),
		threshold: v.picklist(['majority', 'percent']),
		percent: v.pipe(
			v.optional(v.number('A percentage'), 67),
			v.integer('Whole percent'),
			v.minValue(1, 'At least 1%'),
			v.maxValue(100, 'At most 100%')
		),
		quorum: v.pipe(
			v.optional(v.number('A percentage'), 0),
			v.integer('Whole percent'),
			v.minValue(0, 'At least 0%'),
			v.maxValue(100, 'At most 100%')
		),
		early: v.picklist(['yes', 'no'])
	}),
	v.forward(
		v.check(
			(f) => f.kind !== 'shares' || v.safeParse(shareTable, f.shares).success,
			'The share table is not whole'
		),
		['shares']
	),
	v.forward(
		v.check(
			(f) => f.kind !== 'info' || f.newName.trim().length >= 2,
			'The name needs at least 2 characters'
		),
		['newName']
	),
	v.forward(
		v.check(
			(f) => f.kind !== 'info' || f.newName.trim().length <= 60,
			'The name is at most 60 characters'
		),
		['newName']
	),
	v.forward(
		v.check((f) => f.newDescription.length <= 2000, 'The description is at most 2000 characters'),
		['newDescription']
	)
);
