<script lang="ts">
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import { theme, toggleTheme } from '$lib/theme.svelte';
</script>

<button
	type="button"
	class="flex size-8 items-center justify-center rounded-full border border-border text-ink-mid transition-colors hover:border-orange/40 hover:bg-orange-dim hover:text-orange"
	aria-label={theme.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
	onclick={toggleTheme}
>
	{#if theme.mode === 'dark'}<Sun size={16} />{:else}<Moon size={16} />{/if}
</button>
