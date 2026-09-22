<script lang="ts">
	import Info from '@lucide/svelte/icons/info';

	/**
	 * A small "i" that opens a few sentences on hover or focus: the long version of a label,
	 * for whoever wants it, out of the way of whoever does not. Pure CSS, so it works inside a
	 * label that is itself a radio.
	 */
	let {
		text,
		align = 'start',
		class: className = ''
	}: { text: string; align?: 'start' | 'end'; class?: string } = $props();
</script>

<!-- A button so the keyboard reaches it; it does nothing on click, which suits a label that is a radio. -->
<button
	type="button"
	class="group relative inline-flex shrink-0 cursor-help align-middle outline-none {className}"
	aria-label={text}
	onclick={(e) => e.preventDefault()}
>
	<Info
		size={13}
		class="text-ink-dim transition-colors group-hover:text-orange group-focus:text-orange"
		aria-hidden="true"
	/>
	<span
		class="pointer-events-none absolute top-full z-30 mt-1.5 hidden w-72 border border-border bg-surface p-3 text-left font-sans text-xs leading-relaxed font-normal tracking-normal text-ink-mid normal-case shadow-lg group-hover:block group-focus:block {align ===
		'end'
			? 'right-0'
			: 'left-0'}"
	>
		{text}
	</span>
</button>
