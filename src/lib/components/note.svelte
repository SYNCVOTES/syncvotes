<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A remark in the flow of the page, not another box: a rule on the left, coloured by what
	 * it is about. `info` for plain facts, `warn` for caution, `danger` for what failed or
	 * cannot be undone, `success` for what went through.
	 */
	let {
		tone = 'info',
		mono = false,
		class: className = '',
		children
	}: {
		tone?: 'info' | 'warn' | 'danger' | 'success';
		mono?: boolean;
		class?: string;
		children: Snippet;
	} = $props();
	const tones = {
		info: 'border-border',
		warn: 'border-amber',
		danger: 'border-red',
		success: 'border-green'
	};
</script>

<div
	class="border-l-2 pl-3 leading-relaxed text-ink-mid {tones[tone]} {mono
		? 'font-mono text-xs'
		: 'text-body-sm'} {className}"
>
	{@render children()}
</div>
