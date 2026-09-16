<script lang="ts">
	import { reveal, tag, body } from './landing-classes';

	/** A hairline row: who, in orange; what, in caps; why, in mono. */
	let {
		tag: label,
		title,
		text,
		delay = 0
	}: { tag: string; title: string; text: string; delay?: number } = $props();
</script>

<div
	class="{reveal} grid gap-4 border-b border-border py-9 md:grid-cols-[200px_1fr_1fr] md:gap-10 md:py-11"
	style="transition-delay: {delay}s"
>
	<div class="{tag} text-orange">{label}</div>
	<h3
		class="font-display text-[clamp(24px,2.4vw,34px)] leading-[1.05] font-bold tracking-[-0.02em] uppercase"
	>
		{title}
	</h3>
	<p class="{body} max-w-[440px]">{text}</p>
</div>
