<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import DocNote from '$lib/components/doc-note.svelte';
	import myDaosLight from '$lib/assets/docs/my-daos-waiting-light.webp';
	import myDaosDark from '$lib/assets/docs/my-daos-waiting-dark.webp';
	import daoWaitingLight from '$lib/assets/docs/dao-waiting-light.webp';
	import daoWaitingDark from '$lib/assets/docs/dao-waiting-dark.webp';
	import voteLight from '$lib/assets/docs/proposal-vote-light.webp';
	import voteDark from '$lib/assets/docs/proposal-vote-dark.webp';
	import changeLight from '$lib/assets/docs/proposal-change-light.webp';
	import changeDark from '$lib/assets/docs/proposal-change-dark.webp';
	import secretLight from '$lib/assets/docs/proposal-secret-light.webp';
	import secretDark from '$lib/assets/docs/proposal-secret-dark.webp';
	import tallyLight from '$lib/assets/docs/proposal-tally-light.webp';
	import tallyDark from '$lib/assets/docs/proposal-tally-dark.webp';
	import resultLight from '$lib/assets/docs/proposal-result-light.webp';
	import resultDark from '$lib/assets/docs/proposal-result-dark.webp';
	import executedLight from '$lib/assets/docs/proposal-executed-light.webp';
	import executedDark from '$lib/assets/docs/proposal-executed-dark.webp';
</script>

<p>
	On an open proposal you can vote on, the <Ui>Your vote</Ui> box sits at the top of the page, beside
	the text on a wide screen. It shows your voting power before you vote, and your ballot is signed with
	your key.
</p>

<h2 id="find-what-to-vote-on">Find What to Vote On</h2>
<p>
	<Ui>My DAOs</Ui> starts with <Ui>Waiting on your vote</Ui>: each DAO with proposals you can vote
	on and have not. Those DAOs' cards carry a <Ui>3 votes due</Ui> chip (with their count), and the
	<Ui>Not voted</Ui> tab shows only them.
</p>
<Shot
	light={myDaosLight}
	dark={myDaosDark}
	alt="My DAOs with Waiting on your vote at the top and a 3 votes due chip on a card"
	caption="My DAOs, as a member with three proposals to vote on."
/>
<p>
	On a DAO page, a strip says how many proposals wait on your vote; its <Ui>Vote</Ui> button, like the
	<Ui>Not voted</Ui> tab, lists only those. Each of them carries a <Ui>Vote</Ui> chip instead of its status.
</p>
<Shot
	light={daoWaitingLight}
	dark={daoWaitingDark}
	alt="A DAO page: 3 proposals wait on your vote, and rows with Vote chips"
	caption="A DAO page with three proposals waiting on your vote."
/>
<p>
	These count only open proposals before their deadline that you are entitled to vote on. A proposal
	made before you joined, or before your units last changed, is not one of them.
</p>

<h2 id="cast-your-vote">Cast Your Vote</h2>
<Shot
	light={voteLight}
	dark={voteDark}
	alt="Your vote: your voting power, Yes, No and Abstain"
	caption="The vote box on a decision."
/>
<table>
	<thead><tr><th>Proposal</th><th>How you vote</th></tr></thead>
	<tbody>
		<tr><td>Decision, or a change to the DAO</td><td><Ui>Yes</Ui> or <Ui>No</Ui></td></tr>
		<tr><td>Choice, one pick</td><td>The option you want</td></tr>
		<tr>
			<td>Choice, several picks</td>
			<td>Tick the options, then <Ui>Vote for 2 options</Ui> (with your count)</td>
		</tr>
		<tr><td>Any</td><td><Ui>Abstain</Ui>, to take part without taking a side</td></tr>
	</tbody>
</table>
<p>
	An abstention counts toward the quorum but not for or against. On a phone, once the box scrolls
	out of view, Yes, No and Abstain follow along the bottom of the screen. When your ballot lands,
	the box says what you voted and with what share, for example <Ui kind="message"
		>You voted Yes with 50%.</Ui
	>
</p>
<p>
	You cannot start a vote in the last 90 seconds before the deadline, so that a ballot is signed and
	on the ledger in time. The box then says <Ui kind="message">Voting closes in under 90 seconds.</Ui
	>
	If you joined, or your units changed, after the proposal was made, it says
	<Ui kind="message">You joined after this vote opened, so you can't vote.</Ui> or
	<Ui kind="message">Your units changed after this vote opened, so you can't vote.</Ui>
</p>

<h2 id="change-your-vote">Change Your Vote</h2>
<p>
	Where the rule says votes may change, the box offers <Ui>Change vote</Ui> until the deadline. Vote again
	and the new ballot replaces the old one. Such a proposal is counted only after the deadline, so it never
	settles early.
</p>
<Shot
	light={changeLight}
	dark={changeDark}
	alt="You voted No with 50%, and Change vote"
	caption="A proposal whose votes may change."
/>
<p>Everywhere else your first ballot is final, and the box shows only what you voted.</p>

<h2 id="secret-ballots">Secret Ballots</h2>
<p>
	On a secret ballot, every member sees the totals and only their own vote. The ballot list starts
	with <Ui kind="message">Secret ballot. You see only your own vote.</Ui> The app itself still sees every
	ballot, because it counts them. See <a href="/docs/secret-ballots">Secret Ballots</a>.
</p>
<Shot
	light={secretLight}
	dark={secretDark}
	alt="Ballots on a secret ballot: only your own"
	caption="A secret ballot, as a member who voted sees it."
/>

<h2 id="read-the-tally">Read the Tally</h2>
<p>
	The <Ui>Tally</Ui> shows yes, no and abstentions as shares of the <Ui kind="term">whole vote</Ui>:
	all the units that existed when the proposal was made. The middle figure is what yes must reach.
</p>
<Shot
	light={tallyLight}
	dark={tallyDark}
	alt="Tally: 50% yes, 100% to pass, 0% no; 1 voted, 50% of the vote"
	caption="Two eligible members under Majority of the vote: one yes so far, both needed."
/>
<p>
	More than half of 2 members is both of them, so the middle figure reads <code>100% to pass</code>.
	In a DAO of 5 members the same rule needs 3, and the figure reads <code>60% to pass</code>. The
	line under the bar gives how many voted and what share of the vote took part, adds
	<code>(not yet counted)</code> while the figures are ballots the ledger has not counted, and says so
	when a quorum is not met.
</p>
<p>
	A choice shows one bar per option. With one pick, the leading option needs what a yes would, and a
	tie at the top decides nothing. With several picks, every option that reaches the rule is chosen.
	See <a href="/docs/voting-and-counting">Voting and Counting</a>.
</p>

<h2 id="the-result">The Result</h2>
<table>
	<thead><tr><th>Badge</th><th>Means</th></tr></thead>
	<tbody>
		<tr><td><Ui>Open</Ui></td><td>Voting is open.</td></tr>
		<tr>
			<td><Ui>Counting</Ui></td>
			<td>
				The deadline has passed; the page says <Ui kind="message"
					>Voting closed. Counting the last ballots.</Ui
				>
			</td>
		</tr>
		<tr
			><td><Ui>Passed</Ui></td><td
				>A decision passed, or a change passed and is not executed yet.</td
			></tr
		>
		<tr><td><Ui>Executed</Ui></td><td>A change to the DAO passed and is in effect.</td></tr>
		<tr><td><Ui>Decided</Ui></td><td>A choice picked one or more options.</td></tr>
		<tr
			><td><Ui>Failed</Ui></td><td>It missed its rule or its quorum, or a choice ended in a tie.</td
			></tr
		>
	</tbody>
</table>
<p>
	Under the title, the result is said once: <Ui kind="message">Result: Passed.</Ui>, or the options
	a choice picked.
</p>
<Shot
	light={resultLight}
	dark={resultDark}
	alt="A decided choice: Result: Tulips."
	caption="A choice, decided."
/>
<p>
	Where the rule settles early, a proposal is decided the moment the outcome can no longer change;
	otherwise at the deadline. The final count runs about 3 minutes after the deadline, so that
	ballots signed at the last moment still arrive.
</p>
<p>
	A change to the DAO shows <Ui kind="message">Passed. Executing…</Ui> until the app has executed it,
	then the date it was executed. A card spells out what the change did; a large membership change shows
	how many entries are done so far. If execution keeps failing, the page says
	<Ui kind="message">Not executed yet: … Retrying.</Ui> with the reason.
</p>
<Shot
	light={executedLight}
	dark={executedDark}
	alt="An executed membership change: Result: Passed. Executed, and the Membership card listing the party that joined"
	caption="An executed Members change, with who joined."
/>
<DocNote>
	<p>Decisions and choices have nothing to execute; their result is the record.</p>
</DocNote>

<h2 id="ballots-and-comments">Ballots and Comments</h2>
<p>
	Members see <Ui>Ballots</Ui>: who voted, their share, when, and how, searchable by name or party
	ID.
	<Ui>not counted yet</Ui> (or <Ui>may change</Ui>) marks a ballot the ledger has not counted yet.
	Readers of a public DAO see <Ui kind="message">Only members see ballots.</Ui> instead.
</p>
<p>
	Under the ballots, members can comment in Markdown. A comment is a signed transaction, paid like
	any other in the DAO, and stays as written: nobody can edit or delete it. Once voting has ended,
	<Ui>Write a comment</Ui> opens the editor.
</p>
