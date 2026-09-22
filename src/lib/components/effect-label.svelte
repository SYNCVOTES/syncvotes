<script lang="ts">
	import Users from '@lucide/svelte/icons/users';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Power from '@lucide/svelte/icons/power';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import { fmt } from '$lib/format';

	/** What a proposal does, in a glance: an icon and a few words, for lists. */
	type Effect =
		| { kind: 'signal' }
		| { kind: 'members'; add: string[]; remove: string[] }
		| { kind: 'info'; name: string; description: string }
		| { kind: 'dissolve' };
	let { effect }: { effect: Effect } = $props();
	const text = $derived.by(() => {
		switch (effect.kind) {
			case 'members': {
				const parts = [];
				if (effect.add.length) parts.push(`+${fmt(effect.add.length)}`);
				if (effect.remove.length) parts.push(`−${fmt(effect.remove.length)}`);
				return `members ${parts.join(' ')}`;
			}
			case 'info':
				return `rename to ${effect.name}`;
			case 'dissolve':
				return 'dissolve';
			default:
				return 'decision';
		}
	});
	const Icon = $derived(
		effect.kind === 'members'
			? Users
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
