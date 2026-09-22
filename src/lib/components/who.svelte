<script lang="ts">
	import Avatar from './avatar.svelte';
	import PartyId from './party-id.svelte';

	/**
	 * A party in a list: face, the name it gave itself, and its id. Without a profile the id
	 * is all there is, as before.
	 */
	let {
		who,
		me = false,
		size = 'sm',
		class: className = ''
	}: {
		who: { party: string; name: string | null; avatar: string | null };
		me?: boolean;
		size?: 'sm' | 'md';
		class?: string;
	} = $props();
</script>

<span class="flex min-w-0 items-center gap-2.5 {className}">
	<Avatar {who} size={size === 'md' ? 'md' : 'sm'} />
	<span class="min-w-0">
		{#if who.name}
			<span class="block truncate font-display text-[13px] font-bold {me ? 'text-orange' : ''}"
				>{who.name}</span
			>
			<PartyId party={who.party} class="block" />
		{:else}
			<PartyId
				party={who.party}
				{size}
				class="block {me ? '[&>span>span:first-child]:text-orange' : ''}"
			/>
		{/if}
	</span>
</span>
