<script lang="ts">
	import { NETWORK, NETWORKS } from '$app/env/public';
	import { page } from '$app/state';
	import { building } from '$app/environment';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	/**
	 * The network, as a pill like everything else on that row: one dot, one word. Where other
	 * deployments are named, it opens a list of them. Each network is its own site with its own
	 * parties and DAOs, so a switch lands on the same list page, never on a DAO of this one.
	 */
	const others = (NETWORKS ?? '')
		.split(',')
		.map((pair) => pair.trim().split('='))
		.filter(([name, url]) => name && url && name !== NETWORK)
		.map(([name, url]) => ({ name, url: url.replace(/\/$/, '') }));
	const KEEP = ['/', '/app/my-daos', '/app/daos', '/app/wallet'];
	// On MainNet the beta tag is the environment signal; the pill stays as the way to switch.
	const mainnet = NETWORK.toLowerCase() === 'mainnet';
	// The docs are the same on every network, so a docs page stays where it is.
	const path = $derived(
		KEEP.includes(page.url.pathname) ||
			/^\/(docs|privacy|terms|brand)(\/|$)/.test(page.url.pathname)
			? page.url.pathname
			: '/app/my-daos'
	);
	let open = $state(false);
	let root: HTMLElement | undefined = $state();
	// A page rendered ahead (the docs) is built once for every network: which one it is, only the
	// browser knows, so the pill is left out of that HTML rather than naming the wrong network.
</script>

<svelte:window
	onclick={(e) => {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') open = false;
	}}
/>

{#if !building}
	<div class="relative" bind:this={root}>
		<button
			type="button"
			class="flex h-7 items-center gap-1.5 rounded-full border px-2.5 font-mono text-label tracking-[0.14em] uppercase md:h-8 md:gap-2 md:px-3 {mainnet
				? 'border-border text-ink-mid'
				: 'border-amber/30 bg-amber/5 text-amber'} {others.length
				? mainnet
					? 'cursor-pointer hover:border-border-hover'
					: 'cursor-pointer hover:border-amber/60'
				: 'cursor-default'}"
			aria-label="Network: {NETWORK}"
			aria-haspopup={others.length ? 'menu' : undefined}
			aria-expanded={others.length ? open : undefined}
			onclick={() => others.length && (open = !open)}
		>
			<span class="size-1.5 rounded-full {mainnet ? 'bg-green' : 'bg-amber'}"></span>
			{NETWORK}
			{#if others.length}<ChevronDown size={12} aria-hidden="true" />{/if}
		</button>
		{#if open}
			<div
				role="menu"
				class="absolute left-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] border border-border bg-surface p-2 shadow-lg"
			>
				{#each others as n (n.name)}
					<a
						role="menuitem"
						href="{n.url}{path}"
						class="flex items-center gap-2 px-3 py-2 font-mono text-xs tracking-[0.14em] text-ink uppercase hover:bg-surface-hover hover:text-orange"
					>
						<span class="size-1.5 rounded-full bg-ink-dim"></span>
						{n.name}
					</a>
				{/each}
				<p class="mt-1 border-t border-border px-3 pt-2 text-label leading-relaxed text-ink-dim">
					Each network has its own parties and DAOs. To use your key there, restore your phrase.
				</p>
			</div>
		{/if}
	</div>
{/if}
