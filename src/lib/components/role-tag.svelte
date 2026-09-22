<script lang="ts">
	/** creator in amber, member in orange — the app's two roles, in its mono label voice. */
	let { role }: { role: 'creator' | 'member' } = $props();
</script>

<span
	class="font-mono text-xs font-bold tracking-[0.18em] uppercase {role === 'creator'
		? 'text-amber'
		: 'text-orange'}">{role}</span
>
