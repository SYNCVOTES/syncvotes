// Resolve the theme before first paint: a saved choice wins, else the system preference.
// A file rather than an inline script, so the content security policy allows it on every page,
// prerendered ones included, without a nonce.
try {
	var t = localStorage.getItem('syncvotes.theme');
	if (!t) t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
	document.documentElement.dataset.theme = t;
} catch {
	// Storage blocked: the page keeps the dark default.
}
