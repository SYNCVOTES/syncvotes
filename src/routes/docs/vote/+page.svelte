<script lang="ts">
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	Every open proposal has a <strong>Your vote</strong> box at the top of its page (beside the text on
	a wide screen). The box appears for members who can vote on it. Your ballot is signed with your key,
	and your voting power is shown before you cast it.
</p>

<h2 id="find-what-to-vote-on">Find What to Vote On</h2>
<p>Proposals you can vote on and have not are marked on two pages:</p>
<ul>
	<li>
		<strong>My DAOs</strong> lists them under <strong>Waiting on your vote</strong>. Each DAO card
		shows how many votes are due, and the <strong>Not voted</strong> tab filters the list.
	</li>
	<li>
		On a DAO page, a strip says how many proposals wait on your vote, and <strong>Vote</strong>
		shows them. The <strong>Not voted</strong> tab does the same, and each such row carries a
		<strong>Vote</strong> tag.
	</li>
</ul>
<p>
	<strong>Not voted</strong> counts only open proposals before their deadline that you are entitled to
	vote on. A proposal made before you joined, or before your units changed, is not one of them.
</p>

<h2 id="cast-your-vote">Cast Your Vote</h2>
<table>
	<thead><tr><th>Proposal</th><th>How you vote</th></tr></thead>
	<tbody>
		<tr
			><td>Decision or change to the DAO</td><td
				>Select <strong>Yes</strong> or <strong>No</strong>.</td
			></tr
		>
		<tr><td>Choice, one pick</td><td>Select the option you want.</td></tr>
		<tr>
			<td>Choice, several picks</td>
			<td
				>Tick every option you want, then select <strong>Vote for 2 options</strong> (or however many).</td
			>
		</tr>
		<tr><td>Any</td><td>Select <strong>Abstain</strong> to take part without taking a side.</td></tr
		>
	</tbody>
</table>
<p>
	An abstention counts toward the quorum but not for or against. Once your ballot lands, the box
	says what you voted and with what share of the vote, for example
	<strong>You voted Yes with 20%.</strong>
</p>
<p>
	You cannot start a vote in the last 90 seconds before the deadline, since a ballot has to be
	signed and reach the ledger before it. The box then says <strong
		>Voting closes in under 90 seconds.</strong
	>
</p>

<h2 id="change-your-vote">Change Your Vote</h2>
<p>
	Where the proposal's rule says <strong>votes may change</strong>, select
	<strong>Change vote</strong> and vote again until the deadline. The new ballot replaces the old one.
	Such a proposal is counted only after the deadline, so it never settles early.
</p>
<p>
	Everywhere else, your first ballot is final. Voting again is refused with
	<strong>You have already voted. Votes on this proposal are final.</strong>
</p>

<h2 id="secret-ballots">Secret Ballots</h2>
<p>
	On a secret ballot, the page shows the totals to everyone and each member only their own vote. The
	ballot list reads <strong>Secret ballot. You see only your own vote.</strong> The app itself still
	sees every ballot, because it counts them. See <a href="/docs/secret-ballots">Secret Ballots</a>.
</p>

<h2 id="read-the-tally">Read the Tally</h2>
<p>
	The <strong>Tally</strong> shows yes, no and abstentions as shares of the
	<strong>whole vote</strong>: all the units that existed when the proposal was made. The middle
	figure is what yes must reach.
</p>
<p>For example, in a DAO of 5 members under <strong>Majority of the vote</strong>:</p>
<table>
	<thead><tr><th>Figure</th><th>Reads</th><th>Means</th></tr></thead>
	<tbody>
		<tr><td>Left</td><td><code>40% yes</code></td><td>2 of 5 members voted yes</td></tr>
		<tr><td>Middle</td><td><code>60% to pass</code></td><td>3 of 5 must say yes</td></tr>
		<tr><td>Right</td><td><code>20% no</code></td><td>1 member voted no</td></tr>
	</tbody>
</table>
<p>
	The line under it gives the number of voters and the share of the vote that took part. It adds
	<strong>(not yet counted)</strong> while the figures are ballots cast but not yet counted on the ledger.
	When a quorum is set and not met, it says so.
</p>
<p>
	A choice shows one bar per option. With one pick, the leading option needs what a yes would, and a
	tie at the top decides nothing. With several picks, every option that reaches the rule is chosen.
	See <a href="/docs/voting-and-counting">Voting and Counting</a>.
</p>

<h2 id="the-result">The Result</h2>
<p>A proposal's status badge shows where it stands:</p>
<table>
	<thead><tr><th>Status</th><th>Means</th></tr></thead>
	<tbody>
		<tr><td>Open</td><td>Voting is open.</td></tr>
		<tr>
			<td>Counting</td>
			<td>
				The deadline has passed and the last ballots are being counted. The page says
				<strong>Voting closed. Counting the last ballots.</strong>
			</td>
		</tr>
		<tr><td>Passed</td><td>A decision passed, or a change passed and is being executed.</td></tr>
		<tr><td>Executed</td><td>A change to the DAO passed and is now in effect.</td></tr>
		<tr><td>Decided</td><td>A choice picked one or more options.</td></tr>
		<tr><td>Failed</td><td>The proposal did not reach its rule, or a choice ended in a tie.</td></tr
		>
	</tbody>
</table>
<p>
	A proposal is decided as soon as the outcome can no longer change, where its rule settles early.
	Otherwise it is decided at the deadline. The final count runs about 3 minutes after the deadline,
	so that ballots signed at the last moment still arrive.
</p>
<p>
	When a change to the DAO passes, the page shows <strong>Passed. Executing…</strong> until the app
	has executed it, then <strong>Executed</strong> with the date. A large membership change is
	executed in batches of 200. If execution keeps failing, the page shows
	<strong>Not executed yet</strong> with the reason, and the app keeps retrying.
</p>
<DocNote>
	<p>Decisions and choices have nothing to execute. Their result is the record on the ledger.</p>
</DocNote>

<h2 id="ballots-and-comments">Ballots and Comments</h2>
<p>
	Members see the list of ballots: who voted, with what share, when, and how. A ballot marked
	<strong>not counted yet</strong> (or <strong>may change</strong>) has been cast and is not yet in
	the ledger's count. Readers of a public DAO see the totals, not the ballots.
</p>
<p>
	Under the ballots, members can comment in Markdown. Each comment is a signed transaction, paid
	like any other in the DAO, and it stays as written: nobody can edit or delete it. Once voting has
	ended, select <strong>Write a comment</strong> to open the editor.
</p>
