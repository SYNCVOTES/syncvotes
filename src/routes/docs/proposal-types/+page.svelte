<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import DocNote from '$lib/components/doc-note.svelte';
	import typeLight from '$lib/assets/docs/proposal-type-light.webp';
	import typeDark from '$lib/assets/docs/proposal-type-dark.webp';
	import resultLight from '$lib/assets/docs/proposal-result-light.webp';
	import resultDark from '$lib/assets/docs/proposal-result-dark.webp';
	import severalLight from '$lib/assets/docs/proposal-several-light.webp';
	import severalDark from '$lib/assets/docs/proposal-several-dark.webp';
	import executedLight from '$lib/assets/docs/proposal-executed-light.webp';
	import executedDark from '$lib/assets/docs/proposal-executed-dark.webp';
</script>

<p>
	A proposal says what it does, and the ledger does exactly that if it passes. There are seven
	types. Two are <Ui>Decisions and choices</Ui>, which run under a rule their proposer sets. The
	other five are <Ui>Changes to the DAO</Ui>, which run under the DAO's voting rules.
</p>
<Shot
	light={typeLight}
	dark={typeDark}
	alt="The proposal types on the New Proposal page, in two groups with Dissolve apart"
	caption="The types, as the New Proposal page groups them."
/>
<table>
	<thead><tr><th>Type</th><th>If it passes</th></tr></thead>
	<tbody>
		<tr><td><Ui>Decision</Ui></td><td>The DAO's position is on record.</td></tr>
		<tr><td><Ui>Choice</Ui></td><td>The chosen option or options are on record.</td></tr>
		<tr><td><Ui>Members</Ui> / <Ui>Shares</Ui></td><td>Parties join, leave or change units.</td></tr
		>
		<tr>
			<td><Ui>Name and description</Ui></td>
			<td>The DAO gets a new name, description or picture.</td>
		</tr>
		<tr><td><Ui>Voting rules</Ui></td><td>Changes to the DAO pass by new rules.</td></tr>
		<tr><td><Ui>Visibility</Ui></td><td>The DAO becomes public, or private again.</td></tr>
		<tr><td><Ui>Dissolve</Ui></td><td>The DAO closes for good.</td></tr>
	</tbody>
</table>

<h2 id="decision">Decision</h2>
<p>
	A yes-or-no question: approve a budget, adopt a policy, give a mandate. Members vote <Ui>Yes</Ui>,
	<Ui>No</Ui> or <Ui>Abstain</Ui>. If it passes, the outcome is recorded on the ledger. Nothing else
	changes, so its badge stays <Ui>Passed</Ui>.
</p>

<h2 id="choice">Choice</h2>
<p>
	The DAO picks from 2 to 10 options, each up to 80 characters and all different. A member can also
	abstain, which takes part without picking.
</p>
<h3 id="one-pick">One Pick</h3>
<p>
	Each member picks one option. The option with the most units wins if it meets the rule the way a
	yes would, and no other option is level with it. A tie at the top decides nothing, and the
	proposal fails.
</p>
<p>
	Example: 10 members, Majority of the vote. Options A, B and C get 6, 3 and 1 votes: A has more
	than half of the whole vote, so A is chosen. With 4, 4 and 2, nothing is chosen: A and B are tied,
	and neither has more than half anyway.
</p>
<p>
	Where the basis is <Ui>Votes cast</Ui>, the leader is measured against all the votes for options;
	abstentions are left out.
</p>
<Shot
	light={resultLight}
	dark={resultDark}
	alt="A decided choice: the Decided badge and Result: Tulips."
	caption="A choice with one pick, decided."
/>
<h3 id="several-picks">Several Picks</h3>
<p>
	With <Ui>Several options</Ui> on, each member ticks any number of options. Each option is measured against
	the rule on its own, and every option that meets it is chosen. If none does, the proposal fails. The
	proposal list shows such a choice as <code>3 options, pick any</code>.
</p>
<p>
	Where the basis is <Ui>Votes cast</Ui>, each option is measured against the units of the ballots
	that picked anything, since one ballot can back several options.
</p>
<p>
	Example: 10 members, Majority of the vote, three candidates. They get 7, 6 and 4 votes. The first
	two each have more than half of the whole vote, so both are chosen.
</p>
<Shot
	light={severalLight}
	dark={severalDark}
	alt="A several-picks tally: Composting 100%, Pruning fruit trees 50%, Seed saving 50%"
	caption="Two members, several picks, Majority of the vote: only Composting has more than half, so only it is chosen."
/>

<h2 id="members-and-shares">Members and Shares</h2>
<p>
	In a DAO by membership this type is <Ui>Members</Ui>; in a DAO by shares, <Ui>Shares</Ui>. The
	editor starts from today's table. You add parties, remove members or change units, and only what
	changes is put to the vote.
</p>
<ul>
	<li>Each party you add must already be registered with SyncVotes on this network.</li>
	<li>In a DAO by membership, each member holds exactly 1 unit.</li>
	<li>In a DAO by shares, units are whole numbers, and 0 means the member leaves.</li>
	<li>The DAO must keep at least one member with units.</li>
	<li>One proposal can change up to 2,000 parties. It is executed in batches of 200.</li>
	<li>
		Two proposals cannot change the same party at once. The second is refused, naming the first,
		until the first has failed or been executed.
	</li>
</ul>
<Shot
	light={executedLight}
	dark={executedDark}
	alt="An executed Members change: the Membership card lists sam, who joined"
	caption="A Members change, executed: the card lists who joined."
/>
<h3 id="electorate">Who Votes on What</h3>
<p>
	A proposal's electorate is fixed the moment it is made: the members and units of that moment. So:
</p>
<ul>
	<li>Someone who joins later does not vote on proposals made before they joined.</li>
	<li>
		A member whose units change does not vote on proposals made before the change. A ballot they
		cast before it still counts, with the units they had.
	</li>
	<li>
		A member who leaves while a proposal is open can no longer vote on it. Under the whole vote
		their units still count toward the total, as if they had voted no.
	</li>
</ul>
<p>
	On a proposal made before you joined or before your units changed, the vote box says
	<Ui kind="message">You joined after this vote opened, so you can't vote.</Ui> or
	<Ui kind="message">Your units changed after this vote opened, so you can't vote.</Ui>
</p>

<h2 id="name-and-description">Name and Description</h2>
<p>
	Changes the DAO's name (2 to 60 characters), description (Markdown, up to 10,000 characters, may
	be cleared) and picture (an <code>https</code> link, or none). The fields start from the current values.
	On the proposal page a card shows the name, picture and description as they will be.
</p>

<h2 id="voting-rules">Voting Rules</h2>
<p>
	Sets the ballot and rule for every change to the DAO proposed from then on. It passes under the
	current voting rules; proposals already open keep theirs. See
	<a href="/docs/voting-rules">Voting Rules</a>.
</p>

<h2 id="visibility">Visibility</h2>
<p>
	Makes a private DAO public, or a public one private. See
	<a href="/docs/public-and-private-daos">Public and Private DAOs</a>.
</p>

<h2 id="dissolve">Dissolve</h2>
<p>
	Closes the DAO permanently. A passed dissolution does not take effect while anything else in the
	DAO is unfinished: it waits until every other open proposal is decided and every passed change is
	carried out. Meanwhile its page says <Ui kind="message">Passed. Waiting for the vote on “…”</Ui>,
	naming what it waits for. Then:
</p>
<ul>
	<li>nothing more can be proposed in the DAO;</li>
	<li>
		the DAO's page no longer opens (it says <Ui kind="message"
			>No such DAO. It may have been dissolved.</Ui
		>), and the DAO leaves My DAOs and Public DAOs;
	</li>
	<li>
		its proposals, ballots and comments stay on the ledger, and members can still open a proposal by
		its link;
	</li>
	<li>what is left of its balance is lost; nobody gets it back.</li>
</ul>
<DocNote tone="warn" title="Cannot be undone">
	<p>Nothing brings a dissolved DAO back. To start again, members create a new DAO.</p>
</DocNote>

<h2 id="no-cancelling">No Cancelling</h2>
<p>
	Nobody can edit, withdraw or cancel a proposal, its proposer included. A proposal you no longer
	want runs to its deadline; members can vote it down.
</p>
