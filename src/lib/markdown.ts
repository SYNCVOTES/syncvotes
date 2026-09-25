import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { picture } from './picture';

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
		if (node.tagName === 'IMG') {
			node.setAttribute('src', picture(node.getAttribute('src')));
			node.setAttribute('loading', 'lazy');
			// The picture's host learns nothing of the page it was shown on.
			node.setAttribute('referrerpolicy', 'no-referrer');
		}
		// Task-list boxes only, and never ones a reader can tick.
		if (node.tagName === 'INPUT') {
			if (node.getAttribute('type') !== 'checkbox') node.remove();
			else node.setAttribute('disabled', '');
		}
	});
}

/** Safe HTML for `text`, or an empty string outside a browser. */
export function render(text: string): string {
	if (typeof window === 'undefined') return '';
	hook();
	const html = marked.parse(text, { async: false });
	// What Markdown produces, and nothing else: no styles, ids or popovers, so text cannot lay
	// itself over the page or dress up as the app.
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [
			...['p', 'br', 'hr', 'a', 'em', 'strong', 'del', 'code', 'pre', 'blockquote'],
			...['ul', 'ol', 'li', 'input', 'img'],
			...['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
			...['table', 'thead', 'tbody', 'tr', 'th', 'td']
		],
		ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'align', 'type', 'checked', 'disabled', 'start'],
		ADD_ATTR: ['target', 'rel', 'loading', 'referrerpolicy']
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
