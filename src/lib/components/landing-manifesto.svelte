<script lang="ts">
	/** Words that light up as the block scrolls through; the page's script toggles `on`. */
	let { words }: { words: { t: string; a?: boolean; s?: boolean }[] } = $props();
</script>

<section class="manif mx-auto max-w-[calc(1200px+2*var(--spacing-edge))] px-edge py-[72px]">
	<p
		class="font-display text-[clamp(34px,4.6vw,72px)] leading-[1.1] font-bold tracking-[-0.02em] uppercase [word-spacing:0.04em]"
	>
		<!-- eslint-disable svelte/no-useless-mustaches -- a bare space between the spans is dropped -->
		{#each words as w, i (i)}
			<span
				><span
					class="w opacity-[0.13] transition-opacity duration-400 motion-reduce:opacity-100 [&.on]:opacity-100 {w.a
						? 'text-orange'
						: ''} {w.s
						? 'mx-[0.06em] font-editorial text-[1.08em] font-medium normal-case italic'
						: ''}">{w.t}</span
				>{' '}</span
			>
		{/each}
		<!-- eslint-enable svelte/no-useless-mustaches -->
	</p>
</section>
