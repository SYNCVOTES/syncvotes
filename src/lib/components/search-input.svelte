<script lang="ts">
	/* eslint-disable no-useless-assignment -- `value` is bound out and written by the debounce */
	import { Input } from '$lib/components/ui/input';
	import Search from '@lucide/svelte/icons/search';

	/** A filter box for a long list; the value is applied after a pause in typing. */
	let { value = $bindable(''), placeholder = 'Search' }: { value?: string; placeholder?: string } =
		$props();

	let typed = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	const apply = (next: string) => {
		typed = next;
		clearTimeout(timer);
		timer = setTimeout(() => (value = next.trim()), 250);
	};
</script>

<label class="relative block">
	<Search
		size={14}
		class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-dim"
		aria-hidden="true"
	/>
	<Input
		{placeholder}
		class="pl-9"
		value={typed}
		oninput={(e) => apply((e.currentTarget as HTMLInputElement).value)}
		aria-label={placeholder}
	/>
</label>
