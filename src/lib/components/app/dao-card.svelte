<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	let {
		id,
		name,
		description,
		members,
		openProposals,
		role
	}: {
		id: string;
		name: string;
		description: string;
		members: number;
		openProposals: number;
		role: 'admin' | 'member';
	} = $props();

	const monogram = $derived(name.slice(0, 3).toUpperCase());
</script>

<a
	href="/daos/{id}"
	class="group flex flex-col border border-border bg-surface px-[26px] pt-[26px] pb-5 transition-colors hover:border-border-hover hover:bg-surface-hover"
>
	<div class="mb-[18px] flex items-start justify-between gap-3">
		<div
			class="flex size-[46px] shrink-0 items-center justify-center border border-orange/30 bg-orange-dim font-mono text-xs font-bold tracking-[0.08em] text-orange"
		>
			{monogram}
		</div>
		<span
			class="pt-1 font-mono text-xs font-bold tracking-[0.18em] uppercase {role === 'admin'
				? 'text-amber'
				: 'text-orange'}">{role}</span
		>
	</div>

	<div class="mb-2 font-display text-[17px] leading-tight font-bold tracking-[-0.01em]">{name}</div>
	<div class="mb-[22px] line-clamp-3 flex-1 text-[12.5px] leading-relaxed text-ink-mid">
		{description || 'No description provided.'}
	</div>

	<div class="flex items-center gap-6 border-t border-border pt-3.5">
		<div>
			<div class="font-mono text-[15px] font-bold">{members}</div>
			<div class="mt-0.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">Members</div>
		</div>
		<div>
			<div class="font-mono text-[15px] font-bold">{openProposals}</div>
			<div class="mt-0.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">Open</div>
		</div>
		<ArrowRight
			size={16}
			class="ml-auto text-ink-dim transition-all group-hover:translate-x-0.5 group-hover:text-orange"
			aria-hidden="true"
		/>
	</div>
</a>
