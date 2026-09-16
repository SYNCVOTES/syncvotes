<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	let { href, label }: { href: string; label: string } = $props();
</script>

<a {href} class="eyebrow inline-flex items-center gap-1.5 transition-colors hover:text-orange">
	<ArrowLeft size={14} strokeWidth={2.2} />
	{label}
</a>
