<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Problem from './problem.svelte';

	/**
	 * Submit on the left, the way out on the right; "Signing…" while the key is at work. What
	 * went wrong is said right here, where the click was, not at the top of the page.
	 */
	let {
		label,
		busy = false,
		disabled = false,
		cancelHref,
		problem = null
	}: {
		label: string;
		busy?: boolean;
		disabled?: boolean;
		cancelHref: string;
		problem?: string | null;
	} = $props();
</script>

<div class="space-y-3">
	<Problem message={problem} />
	<div class="flex items-center gap-3">
		<Button type="submit" size="lg" disabled={busy || disabled}>{busy ? 'Signing…' : label}</Button>
		<Button href={cancelHref} variant="ghost">Cancel</Button>
	</div>
</div>
