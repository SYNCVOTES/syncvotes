<script lang="ts">
	import { page } from '$app/state';

	/**
	 * A pill in the header nav; lit on its own page. A DAO's page is under /daos too, but it
	 * is not the public list, so only the list itself lights that pill.
	 */
	let { href, label, size = 'md' }: { href: string; label: string; size?: 'md' | 'sm' } = $props();
	const active = $derived(
		href === '/daos' ? page.url.pathname === '/daos' : page.url.pathname.startsWith(href)
	);
</script>

<a
	{href}
	class="rounded-full font-mono tracking-[0.14em] uppercase transition-colors {size === 'sm'
		? 'px-3 py-1.5 text-[0.6875rem]'
		: 'px-4 py-[7px] text-xs'} {active
		? 'bg-orange-dim text-orange'
		: 'text-ink-mid hover:text-ink'}"
>
	{label}
</a>
