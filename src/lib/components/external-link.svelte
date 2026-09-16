<script lang="ts">
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';

	/** A link that leaves the site, marked as such. */
	let { href, label }: { href: string; label: string } = $props();
</script>

<a
	{href}
	target="_blank"
	rel="noopener"
	class="inline-flex items-center gap-0.5 font-mono text-xs text-ink-mid hover:text-orange"
	>{label}<ArrowUpRight size={12} aria-hidden="true" /></a
>
