<script lang="ts">
	import { tag } from './landing-classes';

	/** "// Privacy" — the small mono line that opens a landing section. */
	let { text }: { text: string } = $props();
</script>

<div class="{tag} mb-[18px]">// {text}</div>
