<script lang="ts">
	import type { Snippet } from 'svelte';
	import Panel from './panel.svelte';

	/** A clause of the terms or the policy: a titled panel of prose, with the odd list or link. */
	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<Panel
	class="space-y-3 text-sm leading-relaxed text-ink-mid [&_a]:text-orange [&_a:hover]:underline [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5"
>
	<h2 class="eyebrow">{title}</h2>
	{@render children()}
</Panel>
