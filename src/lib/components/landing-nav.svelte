<script lang="ts">
	import BrandMark from './brand-mark.svelte';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';

	/**
	 * The landing's nav: transparent over the hero, a blurred bar once the page scrolls (the
	 * page's script toggles `scrolled`); inline links wide, a drawer below 1120px.
	 */
	let { links }: { links: { href: string; label: string; external?: boolean }[] } = $props();
	let open = $state(false);

	const link = 'opacity-65 transition-opacity hover:opacity-100';
	const drawerLink =
		'rounded-lg px-3.5 py-3 font-mono text-[15px] tracking-[0.1em] text-ink-mid uppercase hover:bg-orange-dim hover:text-ink';
</script>

<nav
	class="fixed inset-x-0 top-0 z-50 flex items-center gap-8 border-b border-transparent px-edge py-5 transition-[padding,background-color,border-color] duration-300 max-sm:flex-wrap max-sm:gap-x-4 max-sm:gap-y-2.5 max-sm:px-5 max-sm:py-3.5 [&.scrolled]:border-border [&.scrolled]:bg-[rgba(11,10,8,0.86)] [&.scrolled]:py-3 [&.scrolled]:backdrop-blur-[18px]"
>
	<button
		class="inline-flex items-center gap-2 font-mono text-sm font-bold tracking-[0.22em] max-sm:gap-1.5 max-sm:text-xs max-sm:tracking-[0.16em]"
		type="button"
		onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
	>
		<BrandMark size={15} /> SYNCVOTES
	</button>
	<div
		class="ml-auto hidden gap-7 font-mono text-[13px] tracking-[0.12em] uppercase min-[1121px]:flex"
	>
		{#each links as l (l.href)}
			<a
				href={l.href}
				class={link}
				target={l.external ? '_blank' : undefined}
				rel={l.external ? 'noopener' : undefined}>{l.label}</a
			>
		{/each}
	</div>
	<div class="flex items-center gap-3 max-[1120px]:ml-auto max-sm:gap-2">
		<a
			class="rounded-full border border-current px-4 py-[9px] font-mono text-[13px] tracking-[0.12em] whitespace-nowrap uppercase max-sm:px-[13px] max-sm:py-2 max-sm:text-xs max-sm:tracking-[0.08em]"
			href="/my-daos"
		>
			<!-- eslint-disable-next-line svelte/no-useless-mustaches -- a bare space here is dropped -->
			Launch<span class="max-sm:hidden">{' '}App</span>
		</a>
		<button
			class="hidden size-10 shrink-0 items-center justify-center rounded-[10px] border border-border-hover max-[1120px]:inline-flex"
			type="button"
			aria-label={open ? 'Close menu' : 'Open menu'}
			aria-expanded={open}
			onclick={() => (open = !open)}
		>
			{#if open}<X size={18} />{:else}<Menu size={18} />{/if}
		</button>
	</div>
</nav>

{#if open}
	<div
		class="fixed top-[88px] right-edge left-edge z-[49] flex flex-col gap-1 rounded-[14px] border border-border bg-surface p-3 shadow-[0_24px_60px_rgba(0,0,0,0.55)] max-sm:top-[104px]"
		role="presentation"
		onclick={() => (open = false)}
	>
		{#each links as l (l.href)}
			<a
				href={l.href}
				class={drawerLink}
				target={l.external ? '_blank' : undefined}
				rel={l.external ? 'noopener' : undefined}>{l.label}</a
			>
		{/each}
	</div>
{/if}
