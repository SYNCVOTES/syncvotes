<script lang="ts">
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	A <strong>secret ballot</strong> hides who voted how from the other members. It is part of a proposal's
	rule: the DAO's voting rules set it for changes to the DAO, and a proposer sets it for a decision or
	a choice.
</p>

<h2 id="what-members-see">What Members See</h2>
<table>
	<thead><tr><th></th><th>Open ballot</th><th>Secret ballot</th></tr></thead>
	<tbody>
		<tr><td>The totals (yes, no, abstain, each option)</td><td>Yes</td><td>Yes</td></tr>
		<tr><td>Your own vote</td><td>Yes</td><td>Yes</td></tr>
		<tr><td>Who else voted, and how</td><td>Yes</td><td>No</td></tr>
		<tr><td>How many members voted</td><td>Yes</td><td>Yes</td></tr>
	</tbody>
</table>
<p>
	On a secret ballot, the ballot list shows <strong
		>Secret ballot. You see only your own vote.</strong
	>
	and then your own ballot, if you cast one. Readers of a public DAO see only the totals in either case.
</p>

<h2 id="what-it-does-not-hide">What It Does Not Hide</h2>
<p>
	A secret ballot is secret in the app, not on the ledger. Each ballot is still a contract signed by
	you, the app and the DAO's creator, and it stays on the ledger after it is counted.
</p>
<ul>
	<li>
		<strong>The app sees every ballot.</strong> It counts them, so it has to. The app's operator can read
		who voted how.
	</li>
	<li>
		<strong>The app's validator stores every ballot</strong>, as it stores every contract of every
		DAO it hosts.
	</li>
	<li>
		<strong>The totals can give votes away.</strong> In a small DAO, or when only a few members have voted,
		the totals may show how someone voted.
	</li>
</ul>
<DocNote>
	<p>
		Use a secret ballot to keep members from seeing each other's votes. Do not rely on it to hide
		votes from whoever runs the app. See <a href="/docs/trust-model">Trust Model</a>.
	</p>
</DocNote>

<h2 id="turning-it-on">Turning It On</h2>
<ul>
	<li>
		<strong>For changes to the DAO</strong>: tick <strong>Secret ballot</strong> in the DAO's voting rules
		when you create the DAO, or pass a Voting rules proposal that sets it.
	</li>
	<li>
		<strong>For a decision or a choice</strong>: open <strong>Customize ballot and rule</strong> in
		the proposal form and tick <strong>Secret ballot</strong>.
	</li>
</ul>
<p>A proposal keeps the ballot it opened with, whatever the DAO's rules say later.</p>
