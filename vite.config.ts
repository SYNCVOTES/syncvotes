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
			experimental: {
				remoteFunctions: true,
				explicitEnvironmentVariables: true,
				handleRenderingErrors: true
			}
		})
	]
});
