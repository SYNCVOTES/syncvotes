<script lang="ts">
	/**
	 * A screenshot of the app in the docs, in the reader's theme: both versions are on the page,
	 * CSS shows the one that matches, and the hidden one is never fetched. The images are taken
	 * at 1.5 times their size on screen, which `srcset` says so they are not shown larger.
	 */
	let {
		light,
		dark,
		alt,
		caption
	}: { light: string; dark: string; alt: string; caption?: string } = $props();
</script>

<figure class="doc-shot">
	<img
		class="doc-shot-light"
		src={light}
		srcset="{light} 1.5x"
		{alt}
		loading="lazy"
		decoding="async"
	/>
	<img
		class="doc-shot-dark"
		src={dark}
		srcset="{dark} 1.5x"
		{alt}
		loading="lazy"
		decoding="async"
	/>
	{#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>
