<script lang="ts">
	/** admin in amber, member in orange — the app's two roles, in its mono label voice. */
	let { role }: { role: 'admin' | 'member' } = $props();
</script>

<span
	class="font-mono text-xs font-bold tracking-[0.18em] uppercase {role === 'admin'
		? 'text-amber'
		: 'text-orange'}">{role}</span
>
