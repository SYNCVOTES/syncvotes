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
	v.minLength(1, 'Write a comment'),
	v.maxLength(5000, 'A comment is at most 5000 characters')
);
export const profileName = trimmed('The name', 1, 60);
export const profileBio = v.pipe(v.string(), v.maxLength(2000, 'At most 2000 characters'));
/** A picture, by link: the ledger keeps the link, the picture stays where it is. */
export const imageUrl = v.pipe(
	v.optional(v.string(), ''),
	v.trim(),
	v.maxLength(2000, 'A link is at most 2000 characters'),
	v.check((s) => s === '' || /^https:\/\/\S+$/i.test(s), 'Use an https:// link')
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
	v.check((rows) => rows.every((r) => r.party.includes('::')), 'A row has no party ID'),
	v.check(
		(rows) => rows.every((r) => Number.isInteger(r.share) && r.share >= 0 && r.share <= 1e9),
		'Shares are whole numbers'
	),
	v.check(
		(rows) => new Set(rows.map((r) => r.party)).size === rows.length,
		'A party is listed twice'
	)
);

/** A share table as the ledger reads it: tuples of party and units, the Int as text. */
export const shareTuples = (rows: { party: string; share: number }[]) =>
	rows.map((r) => ({ _1: r.party, _2: String(r.share) }));

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
/** What a rule's fields fall back to where the form does not send them. */
type RuleDefaults = {
	basis: 'all' | 'cast';
	threshold: 'majority' | 'percent' | 'fraction';
	early: 'yes' | 'no';
	days: number;
};
/**
 * A rule's fields under a prefix: `routine` and `sensitive` at the founding, `newRoutine` (a
 * decision's or a choice's own) and `newSensitive` (the DAO's next voting rules) on a proposal.
 */
function ruleFields<P extends string>(prefix: P, d: RuleDefaults) {
	const entries = {
		Basis: v.optional(basisField, d.basis),
		Threshold: v.optional(thresholdField, d.threshold),
		Percent: percentField,
		Num: fractionField,
		Den: fractionField,
		Quorum: quorumField,
		Early: v.optional(yesNo, d.early),
		Changeable: v.optional(yesNo, 'no'),
		Secret: v.optional(yesNo, 'no'),
		Days: v.optional(votingDays, d.days)
	};
	type Entries = typeof entries;
	return Object.fromEntries(Object.entries(entries).map(([k, s]) => [prefix + k, s])) as {
		[K in keyof Entries as `${P}${K & string}`]: Entries[K];
	};
}
const MAJORITY: RuleDefaults = { basis: 'all', threshold: 'majority', early: 'yes', days: 7 };
const TWO_THIRDS: RuleDefaults = { basis: 'all', threshold: 'fraction', early: 'yes', days: 14 };
const EXCLUSIVE = 'Votes that may change cannot settle early';
const FRACTION = 'A fraction is at most one';

const ruleField = (f: object, prefix: string, k: string) =>
	(f as Record<string, unknown>)[prefix + k];
/** Whether a rule's two time switches are not both on: votes that may change never settle early. */
const switchesOk = (f: object, ...prefixes: string[]) =>
	prefixes.every(
		(p) => !(ruleField(f, p, 'Early') === 'yes' && ruleField(f, p, 'Changeable') === 'yes')
	);
/** Whether a rule's fraction, if it has one, is at most one. */
const fractionOk = (f: object, ...prefixes: string[]) =>
	prefixes.every(
		(p) =>
			ruleField(f, p, 'Threshold') !== 'fraction' ||
			Number(ruleField(f, p, 'Num')) <= Number(ruleField(f, p, 'Den'))
	);

export const createDaoForm = v.pipe(
	v.object({
		daoName,
		description: daoDescription,
		image: imageUrl,
		equal: yesNo,
		actorPays: v.optional(yesNo, 'no'),
		public: v.optional(yesNo, 'no'),
		shares: shareChanges,
		...ruleFields('routine', MAJORITY),
		...ruleFields('sensitive', TWO_THIRDS)
	}),
	v.check((f) => switchesOk(f, 'routine', 'sensitive'), EXCLUSIVE),
	v.check((f) => fractionOk(f, 'routine', 'sensitive'), FRACTION),
	v.forward(
		v.check((f) => f.shares.every((r) => r.share > 0), 'Every member needs at least 1 unit'),
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
		// A decision's or a choice's own rule, and the DAO's next voting rules on a rules proposal.
		...ruleFields('newRoutine', MAJORITY),
		...ruleFields('newSensitive', TWO_THIRDS)
	}),
	v.check((f) => switchesOk(f, 'newRoutine', 'newSensitive'), EXCLUSIVE),
	v.check((f) => fractionOk(f, 'newRoutine', 'newSensitive'), FRACTION),
	v.forward(
		v.check(
			(f) => f.kind !== 'shares' || v.safeParse(shareChanges, f.shares).success,
			'A DAO needs at least one member with units'
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
	)
);

export const commentForm = v.object({ proposal: id, body: commentBody });
export const profileForm = v.object({ name: profileName, avatar: imageUrl, bio: profileBio });
