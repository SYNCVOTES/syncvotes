<script lang="ts">
	import { hintOf } from '$lib/format';

	/** A party's face: its picture, or the first letters of its name in a square. */
	let {
		who,
		size = 'sm',
		class: className = ''
	}: {
		who: { party: string; name: string | null; avatar: string | null };
		size?: 'xs' | 'sm' | 'md' | 'lg';
		class?: string;
	} = $props();

	const sizes = {
		xs: 'size-5 text-[0.5625rem]',
		sm: 'size-7 text-label',
		md: 'size-10 text-xs',
		lg: 'size-14 text-xl'
	};
	const label = $derived(who.name || hintOf(who.party));
	const letters = $derived(
		label
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w[0] ?? '')
			.join('')
			.toUpperCase() || '?'
	);
</script>

{#if who.avatar}
	<img
		src={who.avatar}
		alt=""
		class="shrink-0 border border-border object-cover {sizes[size]} {className}"
	/>
{:else}
	<span
		class="flex shrink-0 items-center justify-center border border-border bg-surface-active font-mono font-bold text-ink-mid {sizes[
			size
		]} {className}"
		aria-hidden="true">{letters}</span
	>
{/if}
