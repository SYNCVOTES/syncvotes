<script lang="ts">
	import { NETWORK } from '$app/env/public';
</script>

<!-- The network, as a pill like everything else on that row: one dot, one word. -->
<span
	class="hidden h-8 items-center gap-2 rounded-full border border-amber/30 bg-amber/5 px-3 font-mono text-[0.6875rem] tracking-[0.14em] text-amber uppercase sm:flex"
>
	<span class="size-1.5 rounded-full bg-amber"></span>
	{NETWORK}
</span>
