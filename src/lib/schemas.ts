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
	v.maxValue(30, 'At most thirty days')
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

export const createDaoForm = v.pipe(
	v.object({
		daoName,
		description: daoDescription,
		image: imageUrl,
		equal: yesNo,
		shares: shareChanges,
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
		early: yesNo,
		changeable: yesNo
	}),
	v.forward(
		v.check(
			(f) => !(f.early === 'yes' && f.changeable === 'yes'),
			'Votes that may change cannot settle early'
		),
		['changeable']
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

export const effectKind = v.picklist(['signal', 'shares', 'info', 'payout', 'dissolve', 'rule']);

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
		days: votingDays,
		kind: effectKind,
		shares: v.optional(v.string(), ''),
		newName: v.optional(v.string(), ''),
		newDescription: v.optional(v.string(), ''),
		newImage: imageUrl,
		payoutTo: v.optional(v.string(), ''),
		payoutAmount: v.optional(v.number('An amount of coin'), 0),
		payoutReason: v.optional(v.pipe(v.string(), v.maxLength(500, 'At most 500 characters')), ''),
		remainderTo: v.optional(v.string(), ''),
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
		early: yesNo,
		changeable: yesNo,
		// The DAO's new rule, for a proposal that changes it.
		newBasis: v.optional(v.picklist(['all', 'cast']), 'all'),
		newThreshold: v.optional(v.picklist(['majority', 'percent']), 'majority'),
		newPercent: v.pipe(
			v.optional(v.number('A percentage'), 67),
			v.integer('Whole percent'),
			v.minValue(1, 'At least 1%'),
			v.maxValue(100, 'At most 100%')
		),
		newQuorum: v.pipe(
			v.optional(v.number('A percentage'), 0),
			v.integer('Whole percent'),
			v.minValue(0, 'At least 0%'),
			v.maxValue(100, 'At most 100%')
		),
		newEarly: v.optional(yesNo, 'yes'),
		newChangeable: v.optional(yesNo, 'no')
	}),
	v.forward(
		v.check(
			(f) => f.kind !== 'rule' || !(f.newEarly === 'yes' && f.newChangeable === 'yes'),
			'Votes that may change cannot settle early'
		),
		['newChangeable']
	),
	v.forward(
		v.check(
			(f) => f.kind !== 'shares' || v.safeParse(shareChanges, f.shares).success,
			'The share change is not whole'
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
		v.check(
			(f) => f.newDescription.length <= 10_000,
			'The description is at most 10 000 characters'
		),
		['newDescription']
	),
	v.forward(
		v.check((f) => f.kind !== 'payout' || f.payoutTo.includes('::'), 'A party id to pay'),
		['payoutTo']
	),
	v.forward(
		v.check(
			(f) => f.kind !== 'payout' || v.safeParse(coinAmount, f.payoutAmount).success,
			'An amount of coin, more than zero, at most four decimals'
		),
		['payoutAmount']
	),
	v.forward(
		v.check(
			(f) => f.kind !== 'dissolve' || f.remainderTo.includes('::'),
			'A party id to receive what is left'
		),
		['remainderTo']
	),
	v.forward(
		v.check(
			(f) => !(f.early === 'yes' && f.changeable === 'yes'),
			'Votes that may change cannot settle early'
		),
		['changeable']
	)
);

export const commentForm = v.object({ proposal: id, body: commentBody });
export const editCommentForm = v.object({ comment: id, body: commentBody });
export const profileForm = v.object({ name: profileName, avatar: imageUrl, bio: profileBio });
