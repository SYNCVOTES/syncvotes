/**
 * Dark by default, light by choice. The choice lives in localStorage and is applied before
 * first paint by the inline script in app.html; this module only flips it afterwards.
 */

const KEY = 'syncvotes.theme';

let mode = $state<'dark' | 'light'>('dark');

export const theme = {
	get mode() {
		return mode;
	}
};

export function readTheme() {
	mode = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
	// No choice stored: follow the system, and keep following it while the tab is open.
	let stored: string | null = null;
	try {
		stored = localStorage.getItem(KEY);
	} catch {
		// Private mode: nothing stored.
	}
	if (stored) return;
	const media = window.matchMedia('(prefers-color-scheme: light)');
	const follow = () => {
		mode = media.matches ? 'light' : 'dark';
		document.documentElement.dataset.theme = mode;
	};
	follow();
	media.addEventListener('change', follow);
}

export function toggleTheme() {
	mode = mode === 'dark' ? 'light' : 'dark';
	document.documentElement.dataset.theme = mode;
	try {
		localStorage.setItem(KEY, mode);
	} catch {
		// Private mode — the choice just does not stick.
	}
}
