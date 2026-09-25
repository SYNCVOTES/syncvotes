<script lang="ts">
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	A proposal says what it does, and the ledger does exactly that if it passes. There are seven
	types. Two are decisions and choices, which run under a rule their proposer sets. The other five
	change the DAO and run under the DAO's voting rules.
</p>
<table>
	<thead><tr><th>Type</th><th>Group</th><th>If it passes</th></tr></thead>
	<tbody>
		<tr><td>Decision</td><td>Decisions and choices</td><td>The DAO's position is on record.</td></tr
		>
		<tr
			><td>Choice</td><td>Decisions and choices</td><td
				>The chosen option or options are on record.</td
			></tr
		>
		<tr
			><td>Members / Shares</td><td>Changes to the DAO</td><td
				>Parties join, leave or change units.</td
			></tr
		>
		<tr
			><td>Name and description</td><td>Changes to the DAO</td><td
				>The DAO gets a new name, description or picture.</td
			></tr
		>
		<tr
			><td>Voting rules</td><td>Changes to the DAO</td><td>Changes to the DAO pass by new rules.</td
			></tr
		>
		<tr
			><td>Visibility</td><td>Changes to the DAO</td><td
				>The DAO becomes public, or private again.</td
			></tr
		>
		<tr><td>Dissolve</td><td>Changes to the DAO</td><td>The DAO closes permanently.</td></tr>
	</tbody>
</table>

<h2 id="decision">Decision</h2>
<p>
	A yes-or-no question: approve a budget, adopt a policy, give a mandate. Members vote
	<strong>Yes</strong>, <strong>No</strong> or <strong>Abstain</strong>. If it passes, the outcome
	is recorded on the ledger. Nothing else changes, so its status stays <strong>Passed</strong>.
</p>

<h2 id="choice">Choice</h2>
<p>
	The DAO picks from a list of 2 to 10 options, each up to 80 characters and all different. A member
	can also abstain, which takes part without picking.
</p>
<h3 id="one-pick">One Pick</h3>
<p>
	Each member picks one option. The option with the most units wins if it meets the rule the way a
	yes would, and no other option is level with it. A tie at the top decides nothing, and the
	proposal fails.
</p>
<p>
	Example: 10 members, Majority of the vote. Options A, B and C get 6, 3 and 1 votes. A has more
	than half of the whole vote, so A is chosen. If they get 4, 4 and 2, nothing is chosen: A and B
	are tied, and neither has more than half.
</p>
<p>
	Where the rule counts <strong>votes cast</strong>, the leader is measured against all votes for
	options, and abstentions are left out.
</p>
<h3 id="several-picks">Several Picks</h3>
<p>
	With <strong>Several options</strong> on, each member ticks any number of options. Each option is then
	measured against the rule on its own, and every option that meets it is chosen. If none does, the proposal
	fails.
</p>
<p>
	Where the rule counts <strong>votes cast</strong>, each option is measured against the units of
	the ballots that picked anything, since one ballot can back several options.
</p>
<p>
	Example: 10 members, Majority of the vote, three candidates for two seats. Candidates get 7, 6 and
	4 votes. The first two each have more than half of the whole vote, so both are chosen.
</p>

<h2 id="members-and-shares">Members and Shares</h2>
<p>
	In a DAO by membership this type is called <strong>Members</strong>; in a DAO by shares,
	<strong>Shares</strong>. The editor starts from today's members. You add parties, remove members
	or change units, and only what changes is put to the vote.
</p>
<ul>
	<li>Each party you add must already be registered with SyncVotes on this network.</li>
	<li>In a DAO by membership, each member holds exactly 1 unit.</li>
	<li>In a DAO by shares, units are whole numbers, and 0 means the member leaves.</li>
	<li>The DAO must keep at least one member with units.</li>
	<li>One proposal can change up to 2,000 parties. It is executed in batches of 200.</li>
	<li>
		Two open proposals cannot change the same party. The second is refused until the first has
		failed or been executed.
	</li>
</ul>
<h3 id="electorate">Who Votes on What</h3>
<p>
	A proposal's electorate is fixed the moment it is made: the members and units of that moment. This
	has three effects:
</p>
<ul>
	<li>Someone who joins later does not vote on proposals made before they joined.</li>
	<li>
		A member whose units change does not vote on proposals made before the change. A ballot they
		cast before it still counts, with the units they had.
	</li>
	<li>
		A member who leaves while a proposal is open can no longer vote on it. Under the whole vote,
		their units still count toward the total, as if they voted no.
	</li>
</ul>
<p>
	On an open proposal made before your change, the vote box says
	<strong>Your units changed after this vote opened, so you can't vote.</strong> or
	<strong>You joined after this vote opened, so you can't vote.</strong>
</p>

<h2 id="name-and-description">Name and Description</h2>
<p>
	Changes the DAO's name (2 to 60 characters), description (Markdown, up to 10,000 characters, may
	be empty) and picture (an <code>https</code> link, or none). The fields start with the current values,
	and the proposal page shows each field as it will be.
</p>

<h2 id="voting-rules">Voting Rules</h2>
<p>
	Sets the ballot and rule for every change to the DAO proposed from then on. It passes under the
	current voting rules. Proposals already open keep theirs. See
	<a href="/docs/voting-rules">Voting Rules</a>.
</p>

<h2 id="visibility">Visibility</h2>
<p>
	Makes a private DAO public, or a public one private. See
	<a href="/docs/public-and-private-daos">Public and Private DAOs</a>.
</p>

<h2 id="dissolve">Dissolve</h2>
<p>When a Dissolve proposal is executed, the DAO closes permanently:</p>
<ul>
	<li>nothing more can be proposed in it;</li>
	<li>its page no longer opens, and it leaves My DAOs and Public DAOs;</li>
	<li>proposals still open are never decided;</li>
	<li>what is left of its balance is lost, and nobody gets it back.</li>
</ul>
<p>
	Its proposals, ballots and comments stay on the ledger, and their pages still open by their links
	for members.
</p>
<DocNote tone="warn" title="Cannot be undone">
	<p>Nothing brings a dissolved DAO back. To start again, members create a new DAO.</p>
</DocNote>

<h2 id="no-cancelling">No Cancelling</h2>
<p>
	Nobody can edit, withdraw or cancel a proposal, including its proposer. A proposal you no longer
	want runs to its deadline; members can vote it down.
</p>
