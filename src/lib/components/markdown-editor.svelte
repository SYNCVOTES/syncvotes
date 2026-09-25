<script lang="ts">
	import { Textarea } from '$lib/components/ui/textarea';
	import { Input } from '$lib/components/ui/input';
	import Markdown from './markdown.svelte';
	import Bold from '@lucide/svelte/icons/bold';
	import Italic from '@lucide/svelte/icons/italic';
	import Heading from '@lucide/svelte/icons/heading';
	import Link from '@lucide/svelte/icons/link';
	import List from '@lucide/svelte/icons/list';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import Quote from '@lucide/svelte/icons/quote';
	import Code from '@lucide/svelte/icons/code';
	import Image from '@lucide/svelte/icons/image';

	/**
	 * Markdown, written the way it is written on GitHub: a Write tab with a small toolbar and a
	 * Preview tab that renders it. Pictures go in by link. The text travels in the form under
	 * `name`.
	 */
	let {
		value = $bindable(''),
		name,
		id,
		placeholder = '',
		rows = 6,
		maxlength,
		disabled = false,
		compact = false
	}: {
		value?: string;
		name?: string;
		id?: string;
		placeholder?: string;
		rows?: number;
		maxlength?: number;
		disabled?: boolean;
		/** A comment box: shorter. */
		compact?: boolean;
	} = $props();

	let tab = $state<'write' | 'preview'>('write');
	let area = $state<HTMLTextAreaElement | null>(null);
	let asking = $state<'image' | 'link' | null>(null);
	let url = $state('');

	/** Wraps the selection, or inserts a placeholder in the wrapper. */
	function wrap(before: string, after = before, placeholderText = 'text') {
		const el = area;
		if (!el) return;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const chosen = value.slice(start, end) || placeholderText;
		value = value.slice(0, start) + before + chosen + after + value.slice(end);
		const at = start + before.length;
		queueMicrotask(() => {
			el.focus();
			el.setSelectionRange(at, at + chosen.length);
		});
	}
	/** Puts `prefix` at the start of every selected line. */
	function prefix(p: string | ((i: number) => string)) {
		const el = area;
		if (!el) return;
		const start = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
		const endOfLine = value.indexOf('\n', el.selectionEnd);
		const end = endOfLine === -1 ? value.length : endOfLine;
		const lines = value.slice(start, end).split('\n');
		const done = lines.map((l, i) => (typeof p === 'string' ? p : p(i)) + l).join('\n');
		value = value.slice(0, start) + done + value.slice(end);
		queueMicrotask(() => {
			el.focus();
			el.setSelectionRange(start, start + done.length);
		});
	}
	function takeUrl() {
		const link = url.trim();
		if (asking === 'image') wrap(`![`, `](${link})`, 'picture');
		else wrap(`[`, `](${link})`, 'link text');
		url = '';
		asking = null;
	}

	const tools = [
		{ icon: Bold, title: 'Bold', act: () => wrap('**') },
		{ icon: Italic, title: 'Italic', act: () => wrap('_') },
		{ icon: Heading, title: 'Heading', act: () => prefix('## ') },
		{ icon: Link, title: 'Link', act: () => (asking = asking === 'link' ? null : 'link') },
		{ icon: List, title: 'Bulleted list', act: () => prefix('- ') },
		{ icon: ListOrdered, title: 'Numbered list', act: () => prefix((i) => `${i + 1}. `) },
		{ icon: Quote, title: 'Quote', act: () => prefix('> ') },
		{ icon: Code, title: 'Code', act: () => wrap('`') },
		{
			icon: Image,
			title: 'Picture by link',
			act: () => (asking = asking === 'image' ? null : 'image')
		}
	];
	const tabClass = (t: typeof tab) =>
		`px-3 py-1.5 font-mono text-label tracking-[0.14em] uppercase transition-colors ${
			tab === t ? 'border-b-2 border-orange text-ink' : 'text-ink-dim hover:text-ink'
		}`;
</script>

<div class="border border-border">
	<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border px-2">
		<div class="flex">
			<button type="button" class={tabClass('write')} onclick={() => (tab = 'write')}>Write</button>
			<button type="button" class={tabClass('preview')} onclick={() => (tab = 'preview')}
				>Preview</button
			>
		</div>
		{#if tab === 'write'}
			<div class="flex items-center gap-0.5 py-1">
				{#each tools as t (t.title)}
					{@const Icon = t.icon}
					<button
						type="button"
						class="p-1.5 text-ink-dim transition-colors hover:text-ink disabled:opacity-50"
						title={t.title}
						aria-label={t.title}
						{disabled}
						onclick={t.act}><Icon size={14} /></button
					>
				{/each}
			</div>
		{/if}
	</div>

	{#if asking && tab === 'write'}
		<div class="flex items-center gap-2 border-b border-border bg-surface-hover px-3 py-2">
			<Input
				type="url"
				class="font-mono text-xs"
				placeholder={asking === 'image' ? 'https://…/picture.png' : 'https://…'}
				bind:value={url}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						takeUrl();
					} else if (e.key === 'Escape') asking = null;
				}}
			/>
			<button
				type="button"
				class="shrink-0 font-mono text-label tracking-[0.14em] text-orange uppercase disabled:opacity-50"
				disabled={!url.trim()}
				onclick={takeUrl}>Insert</button
			>
			<button
				type="button"
				class="shrink-0 font-mono text-label tracking-[0.14em] text-ink-dim uppercase"
				onclick={() => (asking = null)}>Cancel</button
			>
		</div>
	{/if}

	{#if tab === 'write'}
		<Textarea
			bind:ref={area}
			bind:value
			{name}
			{id}
			{placeholder}
			rows={compact ? 3 : rows}
			{maxlength}
			{disabled}
			class="border-0 focus:ring-0"
		/>
	{:else}
		{#if name}<input type="hidden" {name} {value} />{/if}
		<div class="min-h-[6rem] px-3.5 py-2.5">
			<Markdown text={value} fallback="Nothing to preview." />
		</div>
	{/if}

	<div
		class="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-1.5 font-mono text-label text-ink-dim"
	>
		<span>Markdown. Pictures by link.</span>
		{#if maxlength}<span class={value.length > maxlength ? 'text-red' : ''}
				>{value.length.toLocaleString('en-US')} / {maxlength.toLocaleString('en-US')}</span
			>{/if}
	</div>
</div>
