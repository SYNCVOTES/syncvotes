<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import proposalSecretLight from '$lib/assets/docs/proposal-secret-light.webp';
	import proposalSecretDark from '$lib/assets/docs/proposal-secret-dark.webp';
	import proposalVotingLight from '$lib/assets/docs/proposal-voting-light.webp';
	import proposalVotingDark from '$lib/assets/docs/proposal-voting-dark.webp';
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	A <Ui kind="term">secret ballot</Ui> hides who voted how from the other members. It is part of a proposal's
	rule: the DAO's voting rules set it for changes to the DAO, and a proposer sets it for a decision or
	a choice.
</p>

<h2 id="what-members-see">What Members See</h2>
<table>
	<thead><tr><th></th><th>Open ballot</th><th>Secret ballot</th></tr></thead>
	<tbody>
		<tr
			><td>The totals (yes, no, abstain, each option)</td><td>Yes</td><td>Once it is decided</td
			></tr
		>
		<tr><td>Your own vote</td><td>Yes</td><td>Yes</td></tr>
		<tr><td>Who else voted, and how</td><td>Yes</td><td>No</td></tr>
		<tr><td>How many members voted</td><td>Yes</td><td>Once it is decided</td></tr>
	</tbody>
</table>
<p>
	On a secret ballot, the ballot list shows <strong
		>Secret ballot. You see only your own vote.</strong
	>
	and then your own ballot, if you cast one. Where the totals would be, the page says <Ui
		kind="message">Secret ballot. The totals are shown once the vote is decided.</Ui
	>, and the DAO's proposal list says <Ui>secret ballot</Ui> instead of how many voted: totals that moved
	with each ballot would tell who voted how. Readers of a public DAO see only the totals, and on a secret
	ballot only once it is decided.
</p>

<Shot
	light={proposalSecretLight}
	dark={proposalSecretDark}
	alt="Ballots on a secret ballot: the notice and only your own ballot"
	caption="A secret ballot, as a member who voted sees it."
/>

<h2 id="what-it-does-not-hide">What It Does Not Hide</h2>
<p>
	A secret ballot is secret in the app, not on the ledger. Each ballot is still a contract signed by
	you and the app, and it stays on the ledger after it is counted.
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
		<strong>Ballots cast before 25 September 2026 carry the DAO creator's signature too</strong>, so
		a creator who hosts their party on a validator of their own could obtain those. Ballots cast
		since are signed by the voter and the app only.
	</li>
	<li>
		<strong>The final totals can give votes away.</strong> In a small DAO, or when only a few members
		voted, the totals shown after the decision may show how someone voted.
	</li>
</ul>
<DocNote>
	<p>
		Use a secret ballot to keep members from seeing each other's votes. Do not rely on it to hide
		votes from whoever runs the app. See <a href="/docs/trust-model">Trust Model</a>, and
		<a href="/docs/self-hosting">Self-Hosting</a> to be the one who runs it.
	</p>
</DocNote>

<h2 id="turning-it-on">Turning It On</h2>
<ul>
	<li>
		<strong>For changes to the DAO</strong>: tick <Ui>Secret ballot</Ui> in the DAO's voting rules when
		you create the DAO, or pass a Voting rules proposal that sets it.
	</li>
	<li>
		<strong>For a decision or a choice</strong>: open <Ui>Customize ballot and rule</Ui> in the proposal
		form and tick <Ui>Secret ballot</Ui>.
	</li>
</ul>
<Shot
	light={proposalVotingLight}
	dark={proposalVotingDark}
	alt="Customize ballot and rule, with Secret ballot among the ballot settings"
	caption="Secret ballot, with the other ballot settings, on a proposal form."
/>

<p>A proposal keeps the ballot it opened with, whatever the DAO's rules say later.</p>
