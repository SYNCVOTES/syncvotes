<script lang="ts">
	import Avatar from './avatar.svelte';
	import PartyId from './party-id.svelte';

	/**
	 * A party in a list: face, the name it gave itself, and its id, the face and the name leading
	 * to its page. Without a profile the id is all there is, as before.
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
	const href = $derived(`/app/people/${encodeURIComponent(who.party)}`);
</script>

<span class="flex min-w-0 items-center gap-2.5 {className}">
	<a {href} class="shrink-0" aria-label="Profile of {who.name ?? who.party}">
		<Avatar {who} size={size === 'md' ? 'md' : 'sm'} />
	</a>
	<span class="min-w-0">
		{#if who.name}
			<a
				{href}
				class="block truncate font-display text-body-sm font-bold transition-colors hover:text-orange {me
					? 'text-orange'
					: ''}">{who.name}</a
			>
			<PartyId party={who.party} />
		{:else}
			<PartyId party={who.party} {size} class={me ? '[&>span>span:first-child]:text-orange' : ''} />
		{/if}
	</span>
</span>
