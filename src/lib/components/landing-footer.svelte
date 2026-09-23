<script lang="ts">
	import BrandMark from './brand-mark.svelte';

	let { github }: { github: string } = $props();
</script>

<footer
	class="flex flex-wrap justify-between gap-4 border-t border-border px-edge py-7 font-mono text-[12.5px] tracking-[0.12em] text-ink-dim uppercase [&_a:hover]:text-ink"
>
	<span class="inline-flex items-center gap-2"
		><BrandMark size={12} /> SyncVotes · Canton Network</span
	>
	<span
		>Daml-native governance · <a href={github} target="_blank" rel="noopener">GitHub</a> ·
		<a href="/version">build</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> ·
		<a href="/brand">Brand</a></span
	>
	<span>© {new Date().getFullYear()}</span>
</footer>
