<script lang="ts">
	import { NETWORK, NETWORKS } from '$app/env/public';
	import { page } from '$app/state';
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
	const KEEP = ['/', '/my-daos', '/daos', '/wallet'];
	const path = $derived(KEEP.includes(page.url.pathname) ? page.url.pathname : '/my-daos');
	let open = $state(false);
	let root: HTMLElement | undefined = $state();
</script>

<svelte:window
	onclick={(e) => {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') open = false;
	}}
/>

<div class="relative hidden sm:block" bind:this={root}>
	<button
		type="button"
		class="flex h-8 items-center gap-2 rounded-full border border-amber/30 bg-amber/5 px-3 font-mono text-label tracking-[0.14em] text-amber uppercase {others.length
			? 'cursor-pointer hover:border-amber/60'
			: 'cursor-default'}"
		aria-haspopup={others.length ? 'menu' : undefined}
		aria-expanded={others.length ? open : undefined}
		onclick={() => others.length && (open = !open)}
	>
		<span class="size-1.5 rounded-full bg-amber"></span>
		{NETWORK}
		{#if others.length}<ChevronDown size={12} aria-hidden="true" />{/if}
	</button>
	{#if open}
		<div
			role="menu"
			class="absolute right-0 z-50 mt-2 w-64 border border-border bg-surface p-2 shadow-lg"
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
				Each network is a site of its own, with its own parties and DAOs. A key kept on this one is
				not on the others: restore your phrase there.
			</p>
		</div>
	{/if}
</div>
