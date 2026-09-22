/**
 * A proposal's decision rule, as the ledger stores it and as the pages describe it. Shared by
 * the server's index, the create form's intent and the tally, so every one says the same thing.
 */
export type Rule = {
	/** Yes is measured against everyone eligible, or against the votes cast (yes and no). */
	basis: 'all' | 'cast';
	/** Strictly more than half, or at least this many percent. */
	threshold: { kind: 'majority' } | { kind: 'percent'; percent: number };
	/** Percent of the vote that must take part (abstentions count); 0 for none. */
	quorum: number;
	/** Settle the moment the outcome can no longer change. */
	early: boolean;
};

export type Preset = 'majority' | 'cast' | 'twoThirds' | 'unanimous' | 'custom';

export const PRESETS: { value: Preset; title: string; text: string; rule?: Rule }[] = [
	{
		value: 'majority',
		title: 'Majority of the vote',
		text: 'More than half of the whole vote says yes. Settles early once it is sure.',
		rule: { basis: 'all', threshold: { kind: 'majority' }, quorum: 0, early: true }
	},
	{
		value: 'cast',
		title: 'Majority of votes cast',
		text: 'More yes than no among those who vote, if at least a quarter take part.',
		rule: { basis: 'cast', threshold: { kind: 'majority' }, quorum: 25, early: true }
	},
	{
		value: 'twoThirds',
		title: 'Two thirds of the vote',
		text: 'At least 67% of the whole vote says yes.',
		rule: { basis: 'all', threshold: { kind: 'percent', percent: 67 }, quorum: 0, early: true }
	},
	{
		value: 'unanimous',
		title: 'Unanimous',
		text: 'The whole vote says yes; one no or abstention fails it.',
		rule: { basis: 'all', threshold: { kind: 'percent', percent: 100 }, quorum: 0, early: true }
	},
	{ value: 'custom', title: 'Custom', text: 'Your own basis, threshold, quorum and timing.' }
];

/** The preset a rule is, if it is one exactly. */
export const presetOf = (r: Rule): Preset =>
	PRESETS.find((p) => p.rule && same(p.rule, r))?.value ?? 'custom';

const same = (a: Rule, b: Rule) =>
	a.basis === b.basis &&
	a.quorum === b.quorum &&
	a.early === b.early &&
	a.threshold.kind === b.threshold.kind &&
	(a.threshold.kind !== 'percent' ||
		b.threshold.kind !== 'percent' ||
		a.threshold.percent === b.threshold.percent);

/** "more than half of all members" — the rule in a sentence fragment. */
export function describe(r: Rule): string {
	const amount =
		r.threshold.kind === 'majority' ? 'more than half' : `at least ${r.threshold.percent}%`;
	const of = r.basis === 'all' ? 'of the whole vote' : 'of the votes cast';
	const quorum = r.quorum > 0 ? `, if ${r.quorum}% of the vote takes part` : '';
	return `${amount} ${of} say yes${quorum}`;
}

/** "majority of all", "≥67% of cast · quorum 25%" — the rule in a few characters, for lists. */
export function short(r: Rule): string {
	const amount = r.threshold.kind === 'majority' ? 'majority' : `≥${r.threshold.percent}%`;
	const of = r.basis === 'all' ? 'of all' : 'of cast';
	return `${amount} ${of}${r.quorum > 0 ? ` · quorum ${r.quorum}%` : ''}`;
}

/** Where a count stands against its rule, in the tally's words. */
export function standing(
	r: Rule,
	yes: number,
	no: number,
	abstain: number,
	eligible: number
): { needed: number; denominator: number; quorumMet: boolean; note: string } {
	const cast = yes + no + abstain;
	const denominator = r.basis === 'all' ? eligible : yes + no;
	// Shares are percents with two decimals; "needed" is the smallest weight that passes.
	const needed =
		r.threshold.kind === 'majority'
			? Math.floor(denominator * 50) / 100 + 0.01
			: (denominator * r.threshold.percent) / 100;
	const quorumMet = r.quorum === 0 || cast * 100 >= eligible * r.quorum;
	const note = quorumMet
		? ''
		: `quorum not met: ${cast.toFixed(2)}% took part, ${r.quorum}% needed`;
	return { needed, denominator, quorumMet, note };
}

/** The rule as the ledger's JSON writes it: enums as text, ints as text, the variant tagged. */
export const toLedger = (r: Rule) => ({
	basis: r.basis === 'all' ? 'OfAll' : 'OfCast',
	threshold:
		r.threshold.kind === 'majority'
			? { tag: 'Majority', value: {} }
			: { tag: 'Percent', value: String(r.threshold.percent) },
	quorum: String(r.quorum),
	early: r.early
});
