<script lang="ts">
	import { INVITE_EMAIL, INVITE_MAILTO } from '$lib/site';
	import { cn } from '$lib/utils.js';

	/** The invite address, written out (a mailto alone fails where no mail app is set up). */
	let { class: className = '' }: { class?: string } = $props();
</script>

<a
	href={INVITE_MAILTO}
	class={cn(
		'text-ink underline decoration-orange/60 decoration-1 underline-offset-4 transition-colors hover:text-orange hover:decoration-orange',
		className
	)}>{INVITE_EMAIL}</a
>
