<script lang="ts">
	import PieChart from '@lucide/svelte/icons/pie-chart';
	import Users from '@lucide/svelte/icons/users';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Power from '@lucide/svelte/icons/power';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Eye from '@lucide/svelte/icons/eye';
	import Scale from '@lucide/svelte/icons/scale';
	import { fmt } from '$lib/format';
	import type { Effect } from './effect-card.svelte';

	/** What a proposal does, in a glance: an icon and a few words, for lists. */
	let { effect, equal = false }: { effect: Effect; equal?: boolean } = $props();
	const text = $derived.by(() => {
		switch (effect.kind) {
			case 'shares': {
				const joins = effect.changes.filter((c) => c.share > 0).length;
				const leaves = effect.changes.length - joins;
				return equal
					? [joins && `+${fmt(joins)}`, leaves && `−${fmt(leaves)}`].filter(Boolean).join(' ') +
							' members'
					: `${fmt(effect.changes.length)} ${effect.changes.length === 1 ? 'share' : 'shares'}`;
			}
			case 'choose':
				return `${fmt(effect.options.length)} options${effect.several ? ', pick any' : ''}`;
			case 'info':
				return `rename to ${effect.name}`;
			case 'dissolve':
				return 'dissolve';
			case 'visibility':
				return effect.public ? 'go public' : 'go private';
			case 'settings':
				return 'voting rules';
			default:
				return 'decision';
		}
	});
	const Icon = $derived(
		effect.kind === 'shares'
			? equal
				? Users
				: PieChart
			: effect.kind === 'choose'
				? ListChecks
				: effect.kind === 'info'
					? Pencil
					: effect.kind === 'visibility'
						? Eye
						: effect.kind === 'dissolve'
							? Power
							: effect.kind === 'settings'
								? Scale
								: MessageSquare
	);
</script>

<span class="inline-flex items-center gap-1 {effect.kind === 'dissolve' ? 'text-red' : ''}">
	<Icon size={12} aria-hidden="true" /><span class="truncate">{text}</span>
</span>
