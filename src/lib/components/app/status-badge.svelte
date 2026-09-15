<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';

	let { outcome, closesAt }: { outcome: 'Passed' | 'Failed' | null; closesAt: string } = $props();

	const state = $derived(
		outcome === 'Passed'
			? { label: 'Passed', dot: '✓', variant: 'green' as const }
			: outcome === 'Failed'
				? { label: 'Failed', dot: '✗', variant: 'red' as const }
				: new Date(closesAt).getTime() < Date.now()
					? { label: 'Ended', dot: '○', variant: 'amber' as const }
					: { label: 'Active', dot: '●', variant: 'accent' as const }
	);
</script>

<Badge variant={state.variant}><span aria-hidden="true">{state.dot}</span>{state.label}</Badge>
