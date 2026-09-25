<script lang="ts">
	import { store, flow } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	// Unlocks the stored key wherever the page needs it, so a reload never sends anyone away.
	let password = $state('');
	const kind = $derived(store.screen.at === 'locked' ? store.screen.lock : null);
</script>

{#if kind === 'passkey'}
	<Button disabled={store.busy} onclick={() => flow.unlock()}>Unlock with passkey</Button>
{:else if kind === 'password'}
	<form
		class="flex w-full gap-3"
		onsubmit={(e) => {
			e.preventDefault();
			flow.unlock(password);
			password = '';
		}}
	>
		<Input
			type="password"
			placeholder="password"
			autocomplete="current-password"
			class="flex-1"
			bind:value={password}
		/>
		<Button type="submit" disabled={store.busy || !password}>Unlock</Button>
	</form>
{/if}
