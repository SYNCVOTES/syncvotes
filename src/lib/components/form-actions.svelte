<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	/** Submit on the left, the way out on the right; "Signing…" while the key is at work. */
	let {
		label,
		busy = false,
		disabled = false,
		cancelHref
	}: { label: string; busy?: boolean; disabled?: boolean; cancelHref: string } = $props();
</script>

<div class="flex items-center gap-3">
	<Button type="submit" size="lg" disabled={busy || disabled}>{busy ? 'Signing…' : label}</Button>
	<Button href={cancelHref} variant="ghost">Cancel</Button>
</div>
