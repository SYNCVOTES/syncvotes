/**
 * A proposal's decision rule, as the ledger stores it and as the pages describe it. Shared by
 * the server's index, the create form's intent and the tally, so every one says the same thing.
 */
export type Rule = {
	/** Yes is measured against everyone eligible, or against the votes cast (yes and no). */
	basis: 'all' | 'cast';
	/** Strictly more than half, at least this many percent, or at least a fraction (two thirds). */
	threshold:
		| { kind: 'majority' }
		| { kind: 'percent'; percent: number }
		| { kind: 'fraction'; num: number; den: number };
	/** Percent of the vote that must take part (abstentions count); 0 for none. */
	quorum: number;
	/** Settle the moment the outcome can no longer change. */
	early: boolean;
	/** A voter may replace their ballot until the deadline; excludes `early`. */
	changeable: boolean;
	/** The app shows nobody a vote but their own. */
	secret?: boolean;
};

export type Preset = 'majority' | 'cast' | 'twoThirds' | 'unanimous' | 'custom';

export const PRESETS: { value: Preset; title: string; text: string; rule?: Rule }[] = [
	{
		value: 'majority',
		title: 'Majority of the vote',
		text: 'More than half of the whole vote says yes. Settles early once it is sure.',
		rule: {
			basis: 'all',
			threshold: { kind: 'majority' },
			quorum: 0,
			early: true,
			changeable: false
		}
	},
	{
		value: 'cast',
		title: 'Majority of votes cast',
		text: 'More yes than no among those who vote, if at least a quarter take part.',
		rule: {
			basis: 'cast',
			threshold: { kind: 'majority' },
			quorum: 25,
			early: true,
			changeable: false
		}
	},
	{
		value: 'twoThirds',
		title: 'Two thirds of the vote',
		text: 'At least two thirds of the whole vote say yes — two of three, rounded up.',
		rule: {
			basis: 'all',
			threshold: { kind: 'fraction', num: 2, den: 3 },
			quorum: 0,
			early: true,
			changeable: false
		}
	},
	{
		value: 'unanimous',
		title: 'Unanimous',
		text: 'The whole vote says yes; one no or abstention fails it.',
		rule: {
			basis: 'all',
			threshold: { kind: 'percent', percent: 100 },
			quorum: 0,
			early: true,
			changeable: false
		}
	},
	{
		value: 'custom',
		title: 'Custom',
		text: 'Your own basis, threshold, quorum, timing and whether votes may change.'
	}
];

/** The preset a rule is, if it is one exactly. */
export const presetOf = (r: Rule): Preset =>
	PRESETS.find((p) => p.rule && same(p.rule, r))?.value ?? 'custom';

const same = (a: Rule, b: Rule) =>
	a.basis === b.basis &&
	a.quorum === b.quorum &&
	a.early === b.early &&
	a.changeable === b.changeable &&
	a.threshold.kind === b.threshold.kind &&
	sameThreshold(a.threshold, b.threshold);

const sameThreshold = (a: Rule['threshold'], b: Rule['threshold']) =>
	a.kind === 'majority'
		? b.kind === 'majority'
		: a.kind === 'percent'
			? b.kind === 'percent' && a.percent === b.percent
			: b.kind === 'fraction' && a.num === b.num && a.den === b.den;

/** "two thirds", "three quarters", or "2/5". */
export const fractionWords = (num: number, den: number) => {
	const names: Record<string, string> = {
		'1/2': 'half',
		'2/3': 'two thirds',
		'3/4': 'three quarters',
		'1/3': 'a third',
		'3/5': 'three fifths',
		'4/5': 'four fifths'
	};
	return names[`${num}/${den}`] ?? `${num}/${den}`;
};

/** "more than half of all members" — the rule in a sentence fragment. */
export function describe(r: Rule): string {
	const t = r.threshold;
	const amount =
		t.kind === 'majority'
			? 'more than half'
			: t.kind === 'percent'
				? `at least ${t.percent}%`
				: `at least ${fractionWords(t.num, t.den)}`;
	const of = r.basis === 'all' ? 'of the whole vote' : 'of the votes cast';
	const quorum = r.quorum > 0 ? `, if ${r.quorum}% of the vote takes part` : '';
	return `${amount} ${of} say yes${quorum}`;
}

/** "majority of all", "≥67% of cast · quorum 25%" — the rule in a few characters, for lists. */
export function short(r: Rule): string {
	const t = r.threshold;
	const amount =
		t.kind === 'majority'
			? 'majority'
			: t.kind === 'percent'
				? `≥${t.percent}%`
				: `≥${t.num}/${t.den}`;
	const of = r.basis === 'all' ? 'of all' : 'of cast';
	return `${amount} ${of}${r.quorum > 0 ? ` · quorum ${r.quorum}%` : ''}`;
}

/** Where a count stands against its rule: the numbers are units of the vote. */
export function standing(
	r: Rule,
	yes: number,
	no: number,
	abstain: number,
	eligible: number
): { needed: number; denominator: number; quorumMet: boolean; note: string } {
	const cast = yes + no + abstain;
	const denominator = r.basis === 'all' ? eligible : yes + no;
	// The smallest number of units that passes.
	const t = r.threshold;
	const needed =
		t.kind === 'majority'
			? Math.floor(denominator / 2) + 1
			: t.kind === 'percent'
				? Math.ceil((denominator * t.percent) / 100)
				: Math.ceil((denominator * t.num) / t.den);
	const quorumMet = r.quorum === 0 || cast * 100 >= eligible * r.quorum;
	const pct = (n: number) => (eligible > 0 ? Math.round((n / eligible) * 1000) / 10 : 0);
	const note = quorumMet
		? ''
		: `quorum not met: ${pct(cast)}% of the vote took part, ${r.quorum}% needed`;
	return { needed, denominator, quorumMet, note };
}

/** Whether a rule's numbers are ones the ledger accepts. */
export const validRule = (r: Rule) =>
	r.quorum >= 0 &&
	r.quorum <= 100 &&
	!(r.early && r.changeable) &&
	(r.threshold.kind !== 'fraction' ||
		(r.threshold.num >= 1 && r.threshold.num <= r.threshold.den && r.threshold.den <= 100)) &&
	(r.threshold.kind !== 'percent' || (r.threshold.percent >= 1 && r.threshold.percent <= 100));

/** What proposals of a category run under: the rule they pass by, and how long the vote is open. */
export type Settings = { rule: Rule; votingDays: number };

export type Category = 'routine' | 'sensitive';

/**
 * What a proposal does decides its category: routine (a decision or a choice, which change
 * nothing on the ledger and run under a rule their proposer sets) or sensitive (anything that
 * changes the DAO, which runs under the DAO's own rule).
 */
export const categoryOf = (kind: string): Category =>
	kind === 'signal' || kind === 'choose' ? 'routine' : 'sensitive';

export const CATEGORIES: { value: Category; title: string; text: string; covers: string }[] = [
	{
		value: 'routine',
		title: 'Decisions and choices',
		text: 'The proposer sets the ballot and rule.',
		covers: 'Decisions and choices change nothing on the ledger, so the proposer sets the rule.'
	},
	{
		value: 'sensitive',
		title: 'Changes to the DAO',
		text: 'Members and shares, the name and description, these rules, visibility, dissolution.',
		covers: 'Members and shares, name, description, picture, voting rules, visibility, dissolution.'
	}
];

/** The founding defaults: everyday decisions by a majority in a week, weightier ones by two thirds in two. */
export const DEFAULTS: Record<Category, Settings> = {
	routine: { rule: PRESETS[0].rule!, votingDays: 7 },
	sensitive: { rule: PRESETS[2].rule!, votingDays: 14 }
};

/** A deep copy, so a form edits its own settings and never the object it started from. */
export const copySettings = (s: Settings): Settings => ({
	...s,
	rule: { ...s.rule, threshold: { ...s.rule.threshold } }
});

/**
 * The settings as a form submits them, one field per value under a prefix (`routineBasis`,
 * `n:newSensitiveDays`…; `n:` marks a number). A threshold's unused numbers go as the values
 * the dials start from, so the schema always finds them.
 */
export const settingsFields = (prefix: string, s: Settings): [string, string | number][] => [
	[`${prefix}Basis`, s.rule.basis],
	[`${prefix}Threshold`, s.rule.threshold.kind],
	[`n:${prefix}Percent`, s.rule.threshold.kind === 'percent' ? s.rule.threshold.percent : 67],
	[`n:${prefix}Num`, s.rule.threshold.kind === 'fraction' ? s.rule.threshold.num : 2],
	[`n:${prefix}Den`, s.rule.threshold.kind === 'fraction' ? s.rule.threshold.den : 3],
	[`n:${prefix}Quorum`, s.rule.quorum],
	[`${prefix}Early`, s.rule.early ? 'yes' : 'no'],
	[`${prefix}Changeable`, s.rule.changeable ? 'yes' : 'no'],
	[`${prefix}Secret`, s.rule.secret ? 'yes' : 'no'],
	[`n:${prefix}Days`, s.votingDays]
];

/**
 * The settings back from a form's fields under a prefix. The browser reads the fields it
 * submitted with this and the server the fields it received, so both build the same arguments.
 */
export const settingsOf = (fields: Record<string, unknown>, prefix: string): Settings => {
	const at = (name: string) => fields[prefix + name];
	return {
		rule: {
			basis: at('Basis') as Rule['basis'],
			threshold:
				at('Threshold') === 'percent'
					? { kind: 'percent', percent: Number(at('Percent')) }
					: at('Threshold') === 'fraction'
						? { kind: 'fraction', num: Number(at('Num')), den: Number(at('Den')) }
						: { kind: 'majority' },
			quorum: Number(at('Quorum')),
			early: at('Early') === 'yes',
			changeable: at('Changeable') === 'yes',
			secret: at('Secret') === 'yes'
		},
		votingDays: Number(at('Days'))
	};
};

/** The settings as the ledger's JSON writes them. */
export const settingsToLedger = (s: Settings) => ({
	rule: toLedger(s.rule),
	votingDays: String(s.votingDays)
});

/** The rule as the ledger's JSON writes it: enums as text, ints as text, the variant tagged. */
type LedgerThreshold =
	| { tag: 'Majority'; value: Record<string, never> }
	| { tag: 'Percent'; value: string }
	| { tag: 'Fraction'; value: { num: string; den: string } };
export type LedgerRule = {
	basis: string;
	threshold: LedgerThreshold;
	quorum: string;
	early: boolean;
	changeable: boolean;
	secret: boolean | null;
};
export const toLedger = (r: Rule): LedgerRule => ({
	basis: r.basis === 'all' ? 'OfAll' : 'OfCast',
	threshold:
		r.threshold.kind === 'majority'
			? { tag: 'Majority', value: {} }
			: r.threshold.kind === 'percent'
				? { tag: 'Percent', value: String(r.threshold.percent) }
				: {
						tag: 'Fraction',
						value: { num: String(r.threshold.num), den: String(r.threshold.den) }
					},
	quorum: String(r.quorum),
	early: r.early,
	changeable: r.changeable,
	secret: r.secret ? true : null
});
