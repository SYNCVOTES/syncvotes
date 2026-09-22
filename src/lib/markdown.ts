import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Markdown as the app renders it: GitHub's flavour (tables, task lists, strikethrough, line
 * breaks kept), then cleaned in the browser so nothing a description carries can run. Links
 * open in a new tab; pictures are whatever the text points at, the app's own most of the time.
 */

marked.use({ gfm: true, breaks: true });

let hooked = false;
function hook() {
	if (hooked) return;
	hooked = true;
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (node.tagName === 'A') {
			node.setAttribute('target', '_blank');
			node.setAttribute('rel', 'noopener noreferrer');
		}
		if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
	});
}

/** Safe HTML for `text`, or an empty string outside a browser. */
export function render(text: string): string {
	if (typeof window === 'undefined') return '';
	hook();
	const html = marked.parse(text, { async: false });
	return DOMPurify.sanitize(html, {
		USE_PROFILES: { html: true },
		FORBID_TAGS: ['style', 'form', 'input:not([type=checkbox])'],
		ADD_ATTR: ['target']
	});
}

/** The first line of text, without markup, for lists and previews. */
export function excerpt(text: string, max = 160): string {
	const plain = text
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[#>*_`~-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}
