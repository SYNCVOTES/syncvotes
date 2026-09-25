<script lang="ts">
	import CopyField from './copy-field.svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	/**
	 * How to top up a balance: the app's address and the memo that credits it, behind a
	 * disclosure that opens by itself when the balance needs it. The same words for a party's
	 * own balance and a DAO's.
	 */
	let {
		payTo,
		memo,
		open = false,
		anyone = false
	}: {
		payTo: string;
		memo: string;
		/** Shown open: the balance is empty, or a party is waiting for its top-up. */
		open?: boolean;
		/** Anyone may top this one up, not only its owner (a DAO's balance). */
		anyone?: boolean;
	} = $props();
</script>

<details class="group/pay" {open}>
	<summary
		class="inline-flex h-8 cursor-pointer list-none items-center gap-2 rounded-full border border-border px-4 font-mono text-label tracking-[0.14em] text-ink uppercase transition-colors select-none hover:border-border-hover hover:bg-surface-hover [&::-webkit-details-marker]:hidden"
	>
		Top up
		<ChevronDown
			size={12}
			class="transition-transform group-open/pay:rotate-180"
			aria-hidden="true"
		/>
	</summary>
	<div class="mt-3 space-y-3">
		<p class="text-body-sm text-ink-mid">
			{anyone ? 'Anyone can top up: send' : 'Send'} CC to this address with this memo. Transfers without
			the memo are not credited.
		</p>
		<CopyField label="Address" value={payTo} />
		<CopyField label="Memo" value={memo} />
	</div>
</details>
