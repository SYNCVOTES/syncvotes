/**
 * A picture users linked to, as the page loads it: through this app (`/img`), so the server it
 * lives on never learns who is looking. Anything that is not an https link is left as it is.
 */
export const picture = (url: string | null | undefined): string =>
	url && /^https:\/\//i.test(url) ? `/img?u=${encodeURIComponent(url)}` : (url ?? '');
