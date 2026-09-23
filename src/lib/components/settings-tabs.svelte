<script lang="ts">
	import RuleSettings from './rule-settings.svelte';
	import Hint from './hint.svelte';
	import { CATEGORIES, type Category, type Settings } from '$lib/rules';

	/**
	 * The DAO's two settings as tabs: routine and sensitive, one in view at a time. Both stay
	 * in the form — the tab out of view is hidden, not gone — so what was set on either is
	 * what is submitted.
	 */
	let {
		routine = $bindable(),
		sensitive = $bindable(),
		prefixes,
		eligible = 0,
		equal = false
	}: {
		routine: Settings;
		sensitive: Settings;
		/** The form field prefixes: `routine`/`sensitive` at the founding, `newRoutine`/… in a proposal. */
		prefixes: Record<Category, string>;
		eligible?: number;
		equal?: boolean;
	} = $props();
	let tab = $state<Category>('routine');
	const tabClass = (t: Category) =>
		`px-3 py-2 font-mono text-[0.6875rem] tracking-[0.14em] uppercase transition-colors ${
			tab === t ? 'border-b-2 border-orange text-ink' : 'text-ink-dim hover:text-ink'
		}`;
</script>

<div class="space-y-3">
	<div class="flex border-b border-border" role="tablist">
		{#each CATEGORIES as c (c.value)}
			<button
				type="button"
				role="tab"
				aria-selected={tab === c.value}
				class={tabClass(c.value)}
				onclick={() => (tab = c.value)}>{c.title}</button
			>
		{/each}
	</div>
	{#each CATEGORIES as c (c.value)}
		<div role="tabpanel" hidden={tab !== c.value} class="space-y-2">
			<p class="flex items-center gap-1.5 text-xs text-ink-mid">
				{c.text}
				<Hint text={c.covers} />
			</p>
			{#if c.value === 'routine'}
				<RuleSettings bind:settings={routine} prefix={prefixes.routine} {eligible} {equal} />
			{:else}
				<RuleSettings bind:settings={sensitive} prefix={prefixes.sensitive} {eligible} {equal} />
			{/if}
		</div>
	{/each}
</div>
