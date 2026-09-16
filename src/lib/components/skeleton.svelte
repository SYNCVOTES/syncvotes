<script lang="ts">
	/** A placeholder the size of what is loading. */
	let { height = 'h-40' }: { height?: string } = $props();
</script>

<div class="{height} animate-pulse border border-border bg-surface"></div>
