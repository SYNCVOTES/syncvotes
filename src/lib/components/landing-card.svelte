<script lang="ts">
	import { tag, body } from './landing-classes';

	/** One card: a numeral in the corner, a tag, a title, a paragraph. */
	let {
		num,
		tag: label,
		title,
		text
	}: { num: string; tag: string; title: string; text: string } = $props();
</script>

<div
	class="group/card relative translate-y-10 overflow-hidden bg-background px-9 pt-11 pb-13 opacity-0 transition-[opacity,translate,background-color] duration-800 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-[.in]/grid:translate-y-0 group-[.in]/grid:opacity-100 hover:bg-surface motion-reduce:translate-y-0 motion-reduce:opacity-100 [&:nth-child(2)]:delay-150 [&:nth-child(3)]:delay-300"
>
	<div
		class="absolute top-2 right-4 font-editorial text-[120px] leading-none text-orange/15 italic transition-colors duration-400 group-hover/card:text-orange"
	>
		{num}
	</div>
	<div class={tag}>{label}</div>
	<h3 class="mt-14 font-display text-[30px] font-bold tracking-[-0.02em] uppercase">{title}</h3>
	<p class="{body} mt-4 max-w-[320px]">{text}</p>
</div>
