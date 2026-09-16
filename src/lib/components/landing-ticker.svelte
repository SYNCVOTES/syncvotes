<script lang="ts">
	/** A tape of key/value pairs sliding past; pauses under the pointer. Duplicated so it loops. */
	let { items }: { items: { k: string; v: string }[] } = $props();
</script>

<div class="group overflow-hidden border-y border-border bg-surface py-3.5" aria-hidden="true">
	<ul
		class="flex w-max animate-tape list-none whitespace-nowrap group-hover:[animation-play-state:paused] motion-reduce:animate-none"
	>
		{#each [...items, ...items] as it, i (i)}
			<li class="mr-12 flex gap-2.5 font-mono text-[13px] tracking-[0.06em]">
				<span class="text-ink-dim">{it.k}</span><span>{it.v}</span>
			</li>
		{/each}
	</ul>
</div>
