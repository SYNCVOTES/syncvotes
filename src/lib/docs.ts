/**
 * The documentation's pages, in reading order: one list the sidebar, the index, the page
 * header and the previous/next links all read. Each page's text lives in its own route,
 * `src/routes/docs/<slug>/+page.svelte`.
 */
export type DocPage = {
	slug: string;
	title: string;
	/** The one-line summary under the title, and the page's meta description. */
	description: string;
};

export type DocSection = { title: string; pages: DocPage[] };

export const SECTIONS: DocSection[] = [
	{
		title: 'Introduction',
		pages: [
			{
				slug: 'what-is-syncvotes',
				title: 'What Is SyncVotes',
				description:
					'DAOs, proposals and votes on the Canton Network, signed by keys only their members hold.'
			},
			{
				slug: 'quickstart',
				title: 'Quickstart',
				description:
					'Create a key, a party and a DAO on TestNet, then make a decision and vote on it.'
			}
		]
	},
	{
		title: 'Step by step',
		pages: [
			{
				slug: 'create-a-wallet',
				title: 'Create a Wallet',
				description: 'Make a key in your browser, choose your party hint and create your party.'
			},
			{
				slug: 'create-a-dao',
				title: 'Create a DAO',
				description: 'Name the DAO, choose how it votes and who pays, and add its founding members.'
			},
			{
				slug: 'create-a-proposal',
				title: 'Create a Proposal',
				description: 'Put a decision, a choice or a change to the DAO to its members.'
			},
			{
				slug: 'vote',
				title: 'Vote and See the Result',
				description: 'Cast your ballot, follow the tally and see what the DAO decided.'
			}
		]
	},
	{
		title: 'Concepts',
		pages: [
			{
				slug: 'keys-and-parties',
				title: 'Keys and Parties',
				description:
					'Your key signs, your party acts on the ledger, and the app’s validator hosts it.'
			},
			{
				slug: 'recovery-phrase-and-devices',
				title: 'Recovery Phrase and Devices',
				description: 'How your key is kept on a device, locked and brought back from its phrase.'
			},
			{
				slug: 'public-and-private-daos',
				title: 'Public and Private DAOs',
				description: 'Who can read a DAO, who can act in it, and how to tell the real one.'
			},
			{
				slug: 'voting-rules',
				title: 'Voting Rules',
				description: 'What it takes for a proposal to pass, with worked examples.'
			},
			{
				slug: 'proposal-types',
				title: 'Proposal Types',
				description:
					'Every kind of proposal, what it does when it passes and which rules it runs under.'
			},
			{
				slug: 'voting-and-counting',
				title: 'Voting and Counting',
				description: 'How ballots are counted, what the ledger checks and when a result is final.'
			},
			{
				slug: 'secret-ballots',
				title: 'Secret Ballots',
				description: 'What a secret ballot hides, and from whom.'
			},
			{
				slug: 'balances-and-traffic',
				title: 'Balances and Traffic',
				description: 'Why transactions cost Canton Coin (CC), who pays for what and how to top up.'
			},
			{
				slug: 'profiles',
				title: 'Profiles',
				description: 'A display name, a picture and a few words shown next to your party ID.'
			},
			{
				slug: 'networks',
				title: 'Networks',
				description: 'SyncVotes runs on DevNet, TestNet and MainNet, each a site of its own.'
			}
		]
	},
	{
		title: 'Trust and reference',
		pages: [
			{
				slug: 'trust-model',
				title: 'Trust Model',
				description: 'What the app can and cannot do with your party, your ballots and your DAO.'
			},
			{
				slug: 'self-hosting',
				title: 'Self-Hosting',
				description:
					'Run SyncVotes on your own validator, so no one else’s validator holds your DAOs.'
			},
			{
				slug: 'faq',
				title: 'FAQ',
				description: 'Answers to the questions people ask most.'
			},
			{
				slug: 'glossary',
				title: 'Glossary',
				description: 'The terms SyncVotes uses, one line each.'
			}
		]
	}
];

/** Every page in reading order, with its section. */
export const PAGES = SECTIONS.flatMap((s) => s.pages.map((p) => ({ ...p, section: s.title })));

export const docHref = (slug: string) => `/docs/${slug}`;

/** The page at this path, if it is one; `/docs` itself is the index. */
export const pageAt = (pathname: string) => {
	const slug = pathname.replace(/\/$/, '').split('/docs/')[1];
	return PAGES.find((p) => p.slug === slug) ?? null;
};

/** The pages before and after this one, in reading order. */
export function neighbours(slug: string) {
	const i = PAGES.findIndex((p) => p.slug === slug);
	return { previous: i > 0 ? PAGES[i - 1] : null, next: i >= 0 ? (PAGES[i + 1] ?? null) : null };
}
