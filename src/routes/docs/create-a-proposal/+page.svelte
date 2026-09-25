<script lang="ts">
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	Any member can put a proposal to the DAO. On the DAO page, select <strong>New proposal</strong>.
	The form has up to four sections, and a bar along the bottom says what the proposal does if it
	passes and who votes on it.
</p>

<h2 id="type">Type</h2>
<p>Pick what the proposal does. The types come in two groups, plus dissolving the DAO:</p>
<table>
	<thead><tr><th>Group</th><th>Types</th><th>Rules it runs under</th></tr></thead>
	<tbody>
		<tr>
			<td>Decisions and choices</td>
			<td>Decision, Choice</td>
			<td>A rule you set for this proposal</td>
		</tr>
		<tr>
			<td>Changes to the DAO</td>
			<td>Members or Shares, Name and description, Voting rules, Visibility, Dissolve</td>
			<td>The DAO's voting rules</td>
		</tr>
	</tbody>
</table>
<p>
	A decision or a choice records what the DAO decided and changes nothing else on the ledger, so you
	choose how it passes. A change to the DAO always runs under the DAO's voting rules, and nobody
	proposing it can pick easier ones. Every type is described in full in
	<a href="/docs/proposal-types">Proposal Types</a>.
</p>

<h2 id="details">Details</h2>
<table>
	<thead><tr><th>Field</th><th>What to enter</th></tr></thead>
	<tbody>
		<tr>
			<td>Title</td>
			<td>
				2 to 120 characters. For most types, the app suggests one (for example,
				<code>Change the members</code>) and uses it if you leave the field empty.
			</td>
		</tr>
		<tr>
			<td>Description</td>
			<td>
				What is proposed and why, in Markdown, up to 20,000 characters. Add pictures by linking to
				them. Optional.
			</td>
		</tr>
	</tbody>
</table>

<h2 id="if-it-passes">If It Passes</h2>
<p>This section appears for types that need more input:</p>
<ul>
	<li>
		<strong>Choice</strong>: the options, 2 to 10, each up to 80 characters and all different.
		Select <strong>Add option</strong> for another one.
	</li>
	<li>
		<strong>Members</strong> or <strong>Shares</strong>: today's members to start from. Add, remove
		or change units; only what changes is put to the vote.
	</li>
	<li>
		<strong>Name and description</strong>: the current name, description and picture to edit.
	</li>
	<li>
		<strong>Voting rules</strong>: the ballot and the rule the DAO will use for changes from then
		on.
	</li>
</ul>
<p>A Decision, a Visibility proposal and a Dissolve proposal need nothing more.</p>

<h2 id="voting">Voting</h2>
<h3 id="for-decisions-and-choices">For Decisions and Choices</h3>
<p>
	You set the rule for this proposal. It starts from <strong>Majority of the vote</strong> with a
	7-day voting period. Open <strong>Customize ballot and rule</strong> to change:
</p>
<ul>
	<li><strong>Secret ballot</strong>: members see the totals and only their own vote;</li>
	<li><strong>Votes may change</strong>: members can vote again until the deadline;</li>
	<li>
		<strong>Several options</strong> (Choice only): each member may pick more than one option;
	</li>
	<li>the basis, threshold, quorum, settling early and the voting period (1 to 90 days).</li>
</ul>
<p>See <a href="/docs/voting-rules">Voting Rules</a> for what each setting does.</p>
<h3 id="for-changes-to-the-dao">For Changes to the DAO</h3>
<p>
	The section shows the DAO's voting rules, for example:
	<code
		>Voting rules: open ballot, votes final once cast. Passes when at least two thirds of the whole
		vote say yes; settles early. Open 14 days.</code
	>
	You cannot change them here. Members change them with a Voting rules proposal.
</p>

<h2 id="create">Create</h2>
<p>
	The bar at the bottom says who votes, for example
	<strong>The vote opens for the 5 current members, the moment you sign.</strong> Select
	<strong>Create proposal</strong>. Your key signs, the proposal page opens, and the vote is open.
</p>
<DocNote>
	<p>
		The members and units at the moment you sign are the proposal's electorate. Members who join
		later, or whose units change later, do not vote on it.
	</p>
</DocNote>
<p>
	A proposal cannot be edited, withdrawn or cancelled once it is made. It runs until it is decided.
</p>
<p>
	Who pays for creating the proposal depends on the DAO: its balance, or yours where each member
	pays. Where the DAO pays and its balance is empty, <strong>New proposal</strong> is not shown until
	someone tops it up. Each party can make up to 30 proposals and comments an hour.
</p>
