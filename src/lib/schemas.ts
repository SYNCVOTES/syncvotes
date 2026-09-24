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
	v.maxLength(10_000, 'The description is at most 10 000 characters')
);
export const proposalTitle = trimmed('The title', 2, 120);
export const proposalDescription = v.pipe(
	v.string(),
	v.maxLength(20_000, 'The description is at most 20 000 characters')
);
export const commentBody = v.pipe(
	v.string('A comment is required'),
	v.trim(),
	v.minLength(1, 'A comment says something'),
	v.maxLength(5000, 'A comment is at most 5000 characters')
);
export const profileName = trimmed('The name', 1, 60);
export const profileBio = v.pipe(v.string(), v.maxLength(2000, 'At most 2000 characters'));
/** A picture, by link: the ledger keeps the link, the picture stays where it is. */
export const imageUrl = v.pipe(
	v.optional(v.string(), ''),
	v.trim(),
	v.maxLength(2000, 'A link is at most 2000 characters'),
	v.check((s) => s === '' || /^https:\/\/\S+$/i.test(s), 'A link starting with https://')
);
export const votingDays = v.pipe(
	v.number('The voting period is a number of days'),
	v.integer('Whole days only'),
	v.minValue(1, 'At least one day'),
	v.maxValue(90, 'At most ninety days')
);
export const id = v.pipe(v.string(), v.nonEmpty());
export const partyId = v.pipe(v.string(), v.includes('::'), v.maxLength(300));
export const yesNo = v.picklist(['yes', 'no']);

/** Members created or reshared per transaction; longer lists are carried out in several. */
export const BATCH = 200;
/** The most parties one share change may touch. */
export const MAX_CHANGES = 2000;

/** Party ids as a chips field submits them: separated by whitespace, in the order typed. */
export const partyList = (max = BATCH) =>
	v.pipe(
		v.optional(v.string(), ''),
		v.transform((s) => [...new Set(s.split(/\s+/).filter((t) => t.includes('::')))]),
		v.maxLength(max, `At most ${max} parties at once`)
	);

/**
 * A share change as the editor submits it: one `party=units` per line, units a whole number,
 * zero to leave. The ledger checks the same.
 */
export const shareChanges = v.pipe(
	v.string('Shares are required'),
	v.transform((raw) =>
		raw
			.split(/\n+/)
			.map((l) => l.trim())
			.filter(Boolean)
			.map((l) => {
				const [party, units] = l.split('=');
				return { party: party.trim(), share: Number(units) };
			})
	),
	v.minLength(1, 'At least one member'),
	v.maxLength(MAX_CHANGES, `At most ${MAX_CHANGES} members in one change`),
	v.check((rows) => rows.every((r) => r.party.includes('::')), 'A row has no party id'),
	v.check(
		(rows) => rows.every((r) => Number.isInteger(r.share) && r.share >= 0 && r.share <= 1e9),
		'Shares are whole numbers'
	),
	v.check(
		(rows) => new Set(rows.map((r) => r.party)).size === rows.length,
		'A party is listed twice'
	)
);

/** A category's settings, field by field, under a prefix: `routineBasis`, `routineDays`… */
const basisField = v.picklist(['all', 'cast']);
const thresholdField = v.picklist(['majority', 'percent', 'fraction']);
const fractionField = v.pipe(
	v.optional(v.number('A whole number'), 2),
	v.integer('A whole number'),
	v.minValue(1, 'At least 1'),
	v.maxValue(100, 'At most 100')
);
const percentField = v.pipe(
	v.optional(v.number('A percentage'), 67),
	v.integer('Whole percent'),
	v.minValue(1, 'At least 1%'),
	v.maxValue(100, 'At most 100%')
);
const quorumField = v.pipe(
	v.optional(v.number('A percentage'), 0),
	v.integer('Whole percent'),
	v.minValue(0, 'At least 0%'),
	v.maxValue(100, 'At most 100%')
);
const routineFields = {
	routineBasis: basisField,
	routineThreshold: thresholdField,
	routinePercent: percentField,
	routineNum: fractionField,
	routineDen: fractionField,
	routineQuorum: quorumField,
	routineEarly: yesNo,
	routineChangeable: yesNo,
	routineSecret: v.optional(yesNo, 'no'),
	routineDays: votingDays
};
const sensitiveFields = {
	sensitiveBasis: basisField,
	sensitiveThreshold: thresholdField,
	sensitivePercent: percentField,
	sensitiveNum: fractionField,
	sensitiveDen: fractionField,
	sensitiveQuorum: quorumField,
	sensitiveEarly: yesNo,
	sensitiveChangeable: yesNo,
	sensitiveSecret: v.optional(yesNo, 'no'),
	sensitiveDays: votingDays
};
const newRoutineFields = {
	newRoutineBasis: v.optional(basisField, 'all'),
	newRoutineThreshold: v.optional(thresholdField, 'majority'),
	newRoutinePercent: percentField,
	newRoutineNum: fractionField,
	newRoutineDen: fractionField,
	newRoutineQuorum: quorumField,
	newRoutineEarly: v.optional(yesNo, 'yes'),
	newRoutineChangeable: v.optional(yesNo, 'no'),
	newRoutineSecret: v.optional(yesNo, 'no'),
	newRoutineDays: v.optional(votingDays, 7)
};
const newSensitiveFields = {
	newSensitiveBasis: v.optional(basisField, 'all'),
	newSensitiveThreshold: v.optional(thresholdField, 'fraction'),
	newSensitivePercent: percentField,
	newSensitiveNum: fractionField,
	newSensitiveDen: fractionField,
	newSensitiveQuorum: quorumField,
	newSensitiveEarly: v.optional(yesNo, 'yes'),
	newSensitiveChangeable: v.optional(yesNo, 'no'),
	newSensitiveSecret: v.optional(yesNo, 'no'),
	newSensitiveDays: v.optional(votingDays, 14)
};
const EXCLUSIVE = 'Votes that may change cannot settle early';
const FRACTION = 'A fraction is at most one';

export const createDaoForm = v.pipe(
	v.object({
		daoName,
		description: daoDescription,
		image: imageUrl,
		equal: yesNo,
		actorPays: v.optional(yesNo, 'no'),
		public: v.optional(yesNo, 'no'),
		shares: shareChanges,
		...routineFields,
		...sensitiveFields
	}),
	v.forward(
		v.check((f) => !(f.routineEarly === 'yes' && f.routineChangeable === 'yes'), EXCLUSIVE),
		['routineChangeable']
	),
	v.forward(
		v.check((f) => f.routineThreshold !== 'fraction' || f.routineNum <= f.routineDen, FRACTION),
		['routineNum']
	),
	v.forward(
		v.check((f) => !(f.sensitiveEarly === 'yes' && f.sensitiveChangeable === 'yes'), EXCLUSIVE),
		['sensitiveChangeable']
	),
	v.forward(
		v.check(
			(f) => f.sensitiveThreshold !== 'fraction' || f.sensitiveNum <= f.sensitiveDen,
			FRACTION
		),
		['sensitiveNum']
	),
	v.forward(
		v.check((f) => f.shares.every((r) => r.share > 0), 'Every founding member holds a share'),
		['shares']
	),
	v.forward(
		v.check(
			(f) => f.equal === 'no' || f.shares.every((r) => r.share === 1),
			'By membership, every member holds one unit'
		),
		['shares']
	)
);

export const effectKind = v.picklist([
	'signal',
	'choose',
	'visibility',
	'shares',
	'info',
	'dissolve',
	'settings'
]);

/** A choice's options as typed, one per line, blanks dropped. */
export const parseOptions = (raw: string): string[] =>
	raw
		.split('\n')
		.map((o) => o.trim())
		.filter(Boolean);
export const validOptions = (options: string[]): boolean =>
	options.length >= 2 &&
	options.length <= 10 &&
	options.every((o) => o.length <= 80) &&
	new Set(options).size === options.length;
const OPTIONS = 'Two to ten distinct options, eighty characters each at most';

export const coinAmount = v.pipe(
	v.number('An amount of coin'),
	v.minValue(0.0001, 'More than zero'),
	v.maxValue(1e9, 'Too much'),
	v.check((n) => Math.round(n * 10_000) === n * 10_000, 'At most four decimals')
);

export const createProposalForm = v.pipe(
	v.object({
		dao: id,
		title: proposalTitle,
		description: proposalDescription,
		kind: effectKind,
		shares: v.optional(v.string(), ''),
		newName: v.optional(v.string(), ''),
		newDescription: v.optional(v.string(), ''),
		newImage: imageUrl,
		/** A choice's options, one per line. */
		options: v.optional(v.string(), ''),
		/** A choice where each member picks several options. */
		several: v.optional(yesNo, 'no'),
		/** A visibility proposal: readable by anyone signed in, or members only. */
		newPublic: v.optional(yesNo, 'no'),
		// The DAO's next settings, for a proposal that changes them.
		...newRoutineFields,
		...newSensitiveFields
	}),
	v.forward(
		v.check(
			(f) => f.kind !== 'shares' || v.safeParse(shareChanges, f.shares).success,
			'The share change is not whole'
		),
		['shares']
	),
	v.forward(
		v.check((f) => f.kind !== 'choose' || validOptions(parseOptions(f.options)), OPTIONS),
		['options']
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
		v.check(
			(f) => f.newDescription.length <= 10_000,
			'The description is at most 10 000 characters'
		),
		['newDescription']
	),
	v.forward(
		v.check((f) => !(f.newRoutineEarly === 'yes' && f.newRoutineChangeable === 'yes'), EXCLUSIVE),
		['newRoutineChangeable']
	),
	v.forward(
		v.check(
			(f) => f.newRoutineThreshold !== 'fraction' || f.newRoutineNum <= f.newRoutineDen,
			FRACTION
		),
		['newRoutineNum']
	),
	v.forward(
		v.check(
			(f) => !(f.newSensitiveEarly === 'yes' && f.newSensitiveChangeable === 'yes'),
			EXCLUSIVE
		),
		['newSensitiveChangeable']
	),
	v.forward(
		v.check(
			(f) => f.newSensitiveThreshold !== 'fraction' || f.newSensitiveNum <= f.newSensitiveDen,
			FRACTION
		),
		['newSensitiveNum']
	)
);

export const commentForm = v.object({ proposal: id, body: commentBody });
export const profileForm = v.object({ name: profileName, avatar: imageUrl, bio: profileBio });
