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
		class="text-current opacity-60 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
		aria-hidden="true"
	/>
	<span
		class="pointer-events-none fixed inset-x-4 bottom-4 z-30 hidden border border-border bg-surface p-3 text-left font-sans text-xs leading-relaxed font-normal tracking-normal whitespace-normal text-ink-mid normal-case shadow-lg group-hover:block group-focus:block sm:absolute sm:inset-x-auto sm:top-full sm:bottom-auto sm:mt-1.5 sm:w-72 {align ===
		'end'
			? 'sm:right-0'
			: 'sm:left-0'}"
	>
		{text}
	</span>
</button>
