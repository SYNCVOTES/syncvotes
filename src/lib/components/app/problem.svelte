<script lang="ts">
	let { message }: { message: string | null } = $props();
</script>

{#if message}
	<div class="mb-6 border border-red/30 bg-red/[0.06] px-4 py-3 font-mono text-xs text-red">{message}</div>
{/if}
