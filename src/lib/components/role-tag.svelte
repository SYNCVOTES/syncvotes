<script lang="ts">
	/** A member's role, in the mono label voice. Neutral: a role is a fact, not a call to act. */
	let { role }: { role: 'creator' | 'member' } = $props();
</script>

<span class="font-mono text-label font-bold tracking-[0.18em] text-ink-mid uppercase">{role}</span>
