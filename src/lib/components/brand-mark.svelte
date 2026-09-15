<script lang="ts">
	// The mark: an orange diamond ring with a ballot dot at its centre. The ring is cut with
	// evenodd so the hole is transparent on any background.
	let { size = 14, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 32 32"
	fill="none"
	aria-hidden="true"
	class={`block shrink-0 ${className}`}
>
	<path
		fill-rule="evenodd"
		d="M16 6 L26 16 L16 26 L6 16 Z M16 11 L21 16 L16 21 L11 16 Z"
		fill="var(--accent)"
	/>
	<circle cx="16" cy="16" r="2" fill="var(--text)" />
</svg>
