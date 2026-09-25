<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import proposalTallyLight from '$lib/assets/docs/proposal-tally-light.webp';
	import proposalTallyDark from '$lib/assets/docs/proposal-tally-dark.webp';
	import proposalExecutedLight from '$lib/assets/docs/proposal-executed-light.webp';
	import proposalExecutedDark from '$lib/assets/docs/proposal-executed-dark.webp';
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	Casting a ballot and counting it are two separate steps. You sign your ballot. The app hands
	ballots to the ledger in batches, and the ledger checks each one before it adds it to the
	proposal's count.
</p>

<h2 id="casting">Casting a Ballot</h2>
<p>
	Your ballot is a contract signed by your key. It carries your vote and your units, and it does not
	touch the proposal or anyone else's ballot. That is why thousands of members can vote at the same
	time.
</p>
<p>The app lets you vote on a proposal only when:</p>
<ul>
	<li>it is open and more than 90 seconds from its deadline;</li>
	<li>you were a member, with your current units, when it was made;</li>
	<li>you have not voted on it yet, or its votes may change and your ballot is not counted yet.</li>
</ul>
<p>
	The 90 seconds leave time to sign your ballot and for it to reach the ledger before the deadline.
</p>

<h2 id="counting">Counting</h2>
<p>
	The app counts. It hands the uncounted ballots of a proposal to the ledger in batches of up to
	200, oldest first. It does this whenever something changes on the ledger, and at least every 30
	seconds.
</p>
<p>For each ballot it is handed, the ledger checks that:</p>
<ul>
	<li>it belongs to this DAO and this proposal;</li>
	<li>it was cast before the deadline, against the proposal's deadline and rule;</li>
	<li>
		the voter was a member when the proposal was made, and their units have not changed since;
	</li>
	<li>it has not been counted before;</li>
	<li>
		it answers the right question: yes, no or abstain on a decision or a change; on a choice,
		options that exist, each at most once, and several only where the proposal allows it.
	</li>
</ul>
<p>
	A ballot that fails a check is refused and never counted. The app finds it by splitting the batch,
	leaves it out, and counts the rest. The ledger then adds the ballots to the proposal's totals and
	checks whether the rule is met.
</p>
<DocNote>
	<p>
		The ledger can check every ballot it is handed, but it cannot see a ballot the app did not hand
		in. The <a href="/docs/trust-model">Trust Model</a> explains what that allows.
	</p>
</DocNote>

<h2 id="when-its-decided">When It Is Decided</h2>
<table>
	<thead><tr><th>Rule</th><th>Counted</th><th>Decided</th></tr></thead>
	<tbody>
		<tr>
			<td>Settles early</td>
			<td>As ballots arrive</td>
			<td>As soon as the outcome can no longer change, or at the deadline</td>
		</tr>
		<tr>
			<td>Settles at the deadline</td>
			<td>As ballots arrive</td>
			<td>At the deadline</td>
		</tr>
		<tr>
			<td>Votes may change</td>
			<td>Only after the deadline</td>
			<td>At the deadline</td>
		</tr>
	</tbody>
</table>
<h3 id="grace-period">The Grace Period</h3>
<p>
	A ballot signed just before the deadline can reach the ledger just after it. The ledger accepts
	it, because it was cast in time. So the app waits 3 minutes after the deadline before it makes the
	final count. Until then the proposal shows <Ui>Counting</Ui>.
</p>
<p>
	The final count is the one thing the ledger takes on the app's word: that no ballots are left. It
	then decides the proposal by the ballots it has.
</p>

<h2 id="what-the-page-shows">What the Page Shows</h2>
<p>
	Before the ledger has counted anything, the tally shows the ballots cast, marked
	<Ui kind="message">(not yet counted)</Ui>. Where votes may change, it keeps showing the ballots
	cast until the deadline. In the ballot list, members see <Ui>not counted yet</Ui> or
	<Ui>may change</Ui> next to ballots the ledger has not counted.
</p>
<p>
	All percentages are shares of the whole vote at the time the proposal was made. On a Decision, the
	middle figure is what yes must reach. On a Choice, the line under the bars says what the leading
	option (or, with several picks, any option) needs.
</p>

<Shot
	light={proposalTallyLight}
	dark={proposalTallyDark}
	alt="Tally: 50% yes, 100% to pass, 0% no; 1 voted, 50% of the vote"
	caption="A tally in shares of the whole vote at the time the proposal was made."
/>

<h2 id="execution">Execution</h2>
<p>
	When a change to the DAO passes, the app executes it on the ledger with the DAO's authority. The
	ledger checks that the proposal passed and that the change is the one voted on.
</p>
<ul>
	<li>Most changes take one transaction.</li>
	<li>
		A Members or Shares change is executed in batches of 200 parties. The proposal page shows how
		many entries are done, for example <Ui kind="message">400 of 1,000 executed</Ui>.
	</li>
</ul>
<Shot
	light={proposalExecutedLight}
	dark={proposalExecutedDark}
	alt="An executed Members change with the Membership card"
	caption="A Members change after execution: the card lists each entry."
/>

<h3 id="retries">Retries and Stuck Execution</h3>
<p>
	If a count or an execution fails, for example because the network is busy, the app tries again:
	after 30 seconds, then after twice as long each time, up to every 15 minutes. After 5 failures in
	a row, a passed change shows <Ui kind="message">Not executed yet</Ui> with the reason, and the app keeps
	trying. The note goes away once it succeeds.
</p>

<h2 id="who-pays">Who Pays for Counting</h2>
<p>
	Counting and execution are transactions too. Where the DAO pays, they come out of its balance.
	Where each member pays, they come out of the proposer's own balance. They run even when that
	balance is empty, and it can go below zero. See
	<a href="/docs/balances-and-traffic">Balances and Traffic</a>.
</p>
