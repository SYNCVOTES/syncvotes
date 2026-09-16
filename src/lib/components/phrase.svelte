<script lang="ts">
	/** Twelve words, spaced to be read and selected as one. */
	let { words }: { words: string } = $props();
</script>

<p class="border border-border bg-surface-active p-5 font-mono text-sm leading-8 select-all">
	{words}
</p>
