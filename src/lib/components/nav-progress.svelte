<script lang="ts">
	import { navigating } from '$app/state';

	/**
	 * A thin bar along the top while a navigation is in flight: a click is answered at once,
	 * even when the next page takes a moment to come. It creeps to 90% and finishes when
	 * the page lands; a navigation over quickly shows nothing at all.
	 */
	let shown = $state(false);
	let width = $state(0);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let creep: ReturnType<typeof setInterval> | undefined;
	$effect(() => {
		if (navigating.to) {
			// Only navigations that take a moment get a bar.
			timer = setTimeout(() => {
				shown = true;
				width = 15;
				creep = setInterval(() => (width = Math.min(90, width + (90 - width) * 0.15)), 200);
			}, 150);
		} else {
			clearTimeout(timer);
			clearInterval(creep);
			if (shown) {
				width = 100;
				setTimeout(() => {
					shown = false;
					width = 0;
				}, 250);
			}
		}
		return () => {
			clearTimeout(timer);
			clearInterval(creep);
		};
	});
</script>

{#if shown}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 bg-orange shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)] transition-[width] duration-200 ease-out"
		style="width: {width}%"
		role="progressbar"
		aria-label="Loading the page"
	></div>
{/if}
