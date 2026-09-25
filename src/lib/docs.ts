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

export const SECTIONS: DocSection[] = [];

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
