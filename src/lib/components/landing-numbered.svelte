<script lang="ts">
	import { reveal, tag, body } from './landing-classes';

	/** A numbered entry: a big italic numeral on a rail, then tag, title and paragraph. */
	let {
		index,
		tag: label,
		title,
		text
	}: { index: number; tag: string; title: string; text: string } = $props();
</script>

<li
	class="{reveal} grid grid-cols-[72px_1fr] gap-6 border-b border-border py-9 md:grid-cols-[96px_1fr]"
	style="transition-delay: {index * 0.1}s"
>
	<span class="font-editorial text-[56px] leading-none text-orange italic md:text-[72px]"
		>0{index + 1}</span
	>
	<div>
		<div class={tag}>{label}</div>
		<h3 class="mt-2 font-display text-[24px] leading-[1.1] font-bold tracking-[-0.02em] uppercase">
			{title}
		</h3>
		<p class="{body} mt-3 max-w-[420px]">{text}</p>
	</div>
</li>
