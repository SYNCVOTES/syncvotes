<script lang="ts">
	import { picture } from '$lib/picture';
	import { Input } from '$lib/components/ui/input';
	import Image from '@lucide/svelte/icons/image';
	import X from '@lucide/svelte/icons/x';

	/**
	 * One picture, by link: a DAO's cover, a profile's face. The link travels in the form under
	 * `name` and the picture shows as soon as it loads; empty means none.
	 */
	let {
		value = $bindable(''),
		name,
		id,
		shape = 'wide',
		disabled = false,
		placeholder = 'https://…/picture.png'
	}: {
		value?: string;
		name?: string;
		id?: string;
		shape?: 'wide' | 'square';
		disabled?: boolean;
		placeholder?: string;
	} = $props();

	let failed = $state(false);
	$effect(() => {
		void value;
		failed = false;
	});
	const box = $derived(shape === 'square' ? 'size-24' : 'h-24 w-40');
</script>

<div class="flex flex-wrap items-start gap-4">
	<div
		class="flex {box} shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-hover"
	>
		{#if value.trim() && !failed}
			<img
				referrerpolicy="no-referrer"
				src={picture(value.trim())}
				alt=""
				class="size-full object-cover"
				onerror={() => (failed = true)}
			/>
		{:else}
			<Image size={18} class="text-ink-dim" aria-hidden="true" />
		{/if}
	</div>
	<div class="min-w-[16rem] flex-1 space-y-2">
		<div class="flex items-center gap-2">
			<Input {name} {id} type="url" {placeholder} {disabled} bind:value class="font-mono text-xs" />
			{#if value}
				<button
					type="button"
					class="shrink-0 text-ink-dim hover:text-red"
					aria-label="Clear the link"
					{disabled}
					onclick={() => (value = '')}><X size={14} /></button
				>
			{/if}
		</div>
		<p class="font-mono text-label text-ink-dim">
			{#if failed}<span class="text-red">This link isn't an image.</span>{:else}An https link to an
				image.{/if}
		</p>
	</div>
</div>
