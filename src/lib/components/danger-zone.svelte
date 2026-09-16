<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Panel from './panel.svelte';

	/**
	 * An action that removes something, behind one extra click. `compact` is the version for a
	 * side column: no red frame, small buttons.
	 */
	let {
		title,
		text,
		action,
		confirm,
		busy = false,
		compact = false,
		onconfirm
	}: {
		title?: string;
		text: string;
		action: string;
		confirm: string;
		busy?: boolean;
		compact?: boolean;
		onconfirm: () => void;
	} = $props();

	let confirming = $state(false);
	const size = $derived(compact ? 'sm' : 'default');
</script>

<Panel variant={compact ? 'solid' : 'danger'} padding={compact ? 'sm' : 'md'} class="space-y-3">
	{#if title}<h2 class="eyebrow text-red">{title}</h2>{/if}
	<p class="text-[13px] {compact ? 'text-ink-dim' : 'text-ink-mid'}">{text}</p>
	{#if confirming}
		<div class="flex items-center gap-3">
			<Button variant="destructive" {size} disabled={busy} onclick={onconfirm}>
				{busy ? 'Signing…' : confirm}
			</Button>
			<Button variant="ghost" {size} onclick={() => (confirming = false)}>Keep</Button>
		</div>
	{:else}
		<Button variant="destructive" {size} onclick={() => (confirming = true)}>{action}</Button>
	{/if}
</Panel>
