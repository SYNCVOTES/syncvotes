import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// `dpm codegen-js` emits CommonJS, and Vite does not pre-bundle workspace-linked packages by
	// default, so the browser would otherwise receive raw CJS and fail on the missing named exports.
	// Only the entry package is listed; the optimizer follows its file: dependencies.
	optimizeDeps: { include: ['@daml.js/model'] },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
				experimental: { async: true }
			},
			adapter: adapter(),
			// The whole custody model assumes no script but ours runs on these pages.
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
					'font-src': ['self', 'https://fonts.gstatic.com'],
					// Pictures are links: a DAO's cover, a face, whatever a description embeds.
					'img-src': ['self', 'data:', 'https:'],
					'connect-src': ['self'],
					'frame-ancestors': ['none'],
					'object-src': ['none'],
					'base-uri': ['self']
				}
			},
			experimental: {
				remoteFunctions: true,
				explicitEnvironmentVariables: true,
				handleRenderingErrors: true
			}
		})
	]
});
