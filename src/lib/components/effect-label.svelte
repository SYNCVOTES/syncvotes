<script lang="ts">
	import PieChart from '@lucide/svelte/icons/pie-chart';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Power from '@lucide/svelte/icons/power';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import { fmt } from '$lib/format';

	/** What a proposal does, in a glance: an icon and a few words, for lists. */
	type Effect =
		| { kind: 'signal' }
		| { kind: 'shares'; shares: { party: string; share: number }[] }
		| { kind: 'info'; name: string; description: string }
		| { kind: 'dissolve' };
	let { effect }: { effect: Effect } = $props();
	const text = $derived(
		effect.kind === 'shares'
			? `shares of ${fmt(effect.shares.length)}`
			: effect.kind === 'info'
				? `rename to ${effect.name}`
				: effect.kind === 'dissolve'
					? 'dissolve'
					: 'decision'
	);
	const Icon = $derived(
		effect.kind === 'shares'
			? PieChart
			: effect.kind === 'info'
				? Pencil
				: effect.kind === 'dissolve'
					? Power
					: MessageSquare
	);
</script>

<span class="inline-flex items-center gap-1 {effect.kind === 'dissolve' ? 'text-red' : ''}">
	<Icon size={12} aria-hidden="true" /><span class="truncate">{text}</span>
</span>
