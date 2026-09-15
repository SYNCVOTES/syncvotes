<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import Clock from '@lucide/svelte/icons/clock';

	let { outcome, closesAt }: { outcome: 'Passed' | 'Failed' | null; closesAt: string } = $props();

	const state = $derived(
		outcome === 'Passed'
			? { label: 'Passed', icon: Check, variant: 'green' as const }
			: outcome === 'Failed'
				? { label: 'Failed', icon: X, variant: 'red' as const }
				: new Date(closesAt).getTime() < Date.now()
					? { label: 'Ended', icon: Clock, variant: 'amber' as const }
					: { label: 'Active', icon: null, variant: 'accent' as const }
	);
</script>

<Badge variant={state.variant}>
	{#if state.icon}
		{@const Icon = state.icon}
		<Icon size={11} strokeWidth={2.5} aria-hidden="true" />
	{:else}
		<span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
	{/if}
	{state.label}
</Badge>
