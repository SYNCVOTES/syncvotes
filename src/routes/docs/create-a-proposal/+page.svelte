<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import DocNote from '$lib/components/doc-note.svelte';
	import typeLight from '$lib/assets/docs/proposal-type-light.webp';
	import typeDark from '$lib/assets/docs/proposal-type-dark.webp';
	import votingLight from '$lib/assets/docs/proposal-voting-light.webp';
	import votingDark from '$lib/assets/docs/proposal-voting-dark.webp';
	import daoRulesLight from '$lib/assets/docs/proposal-dao-rules-light.webp';
	import daoRulesDark from '$lib/assets/docs/proposal-dao-rules-dark.webp';
	import barLight from '$lib/assets/docs/proposal-bar-light.webp';
	import barDark from '$lib/assets/docs/proposal-bar-dark.webp';
</script>

<p>
	Any member can put a proposal to the DAO: on the DAO page, select <Ui>New proposal</Ui>. The form
	has up to four numbered sections, and a bar along the bottom says what the proposal does if it
	passes and who votes on it.
</p>

<h2 id="type">01 Type</h2>
<Shot
	light={typeLight}
	dark={typeDark}
	alt="The proposal types in two groups, Decisions and choices and Changes to the DAO, with Dissolve apart"
	caption="The two groups of types, with Dissolve set apart in red."
/>
<table>
	<thead><tr><th>Group</th><th>Types</th><th>Runs under</th></tr></thead>
	<tbody>
		<tr>
			<td><Ui>Decisions and choices</Ui></td>
			<td><Ui>Decision</Ui>, <Ui>Choice</Ui></td>
			<td>A rule you set for this proposal</td>
		</tr>
		<tr>
			<td><Ui>Changes to the DAO</Ui></td>
			<td>
				<Ui>Members</Ui> (or <Ui>Shares</Ui>), <Ui>Name and description</Ui>, <Ui>Voting rules</Ui>,
				<Ui>Visibility</Ui>, and <Ui>Dissolve</Ui>
			</td>
			<td>The DAO's voting rules</td>
		</tr>
	</tbody>
</table>
<p>
	A decision or a choice records what the DAO decided and changes nothing else, so you choose how it
	passes. A change to the DAO always runs under the DAO's voting rules; nobody proposing one can
	pick easier ones. The line under the types says what the selected one does. In the DAO's proposal
	list, changes carry a <Ui>changes the DAO</Ui> tag. Every type is described in
	<a href="/docs/proposal-types">Proposal Types</a>.
</p>

<h2 id="details">02 Details</h2>
<ul>
	<li>
		<Ui>Title</Ui>: 2 to 120 characters. For most types other than a decision, the app suggests one,
		such as <code>Change the members</code>, and uses it if you leave the field empty.
	</li>
	<li>
		<Ui>Description</Ui>: what and why, in Markdown, up to 20,000 characters, with pictures by link.
		Optional.
	</li>
</ul>

<h2 id="if-it-passes">03 If It Passes</h2>
<p>This section appears for the types that need more input:</p>
<ul>
	<li>
		<Ui>Choice</Ui>: <Ui>Options</Ui>, 2 to 10, each up to 80 characters and all different.
		<Ui>Add option</Ui> adds one.
	</li>
	<li>
		<Ui>Members</Ui> or <Ui>Shares</Ui>: today's table to edit. Add, remove, or change units; only
		what differs is put to the vote.
	</li>
	<li><Ui>Name and description</Ui>: the current name, description and picture to edit.</li>
	<li>
		<Ui>Voting rules</Ui>: <Ui>Ballot</Ui> and <Ui>How it passes</Ui> for changes from then on.
	</li>
</ul>
<p>A Decision, a Visibility proposal and a Dissolve proposal need nothing more.</p>

<h2 id="voting">Voting</h2>
<h3 id="for-decisions-and-choices">For Decisions and Choices</h3>
<p>
	The section says <Ui kind="message">Set by you for this proposal.</Ui> The rule starts from
	<Ui>Majority of the vote</Ui>, open 7 days. <Ui>Customize ballot and rule</Ui> opens:
</p>
<ul>
	<li><Ui>Secret ballot</Ui>: members see the totals and only their own vote;</li>
	<li><Ui>Votes may change</Ui>: members can vote again until the deadline;</li>
	<li><Ui>Several options</Ui> (Choice only): a member may pick more than one option;</li>
	<li>
		<Ui>Basis</Ui>, <Ui>Threshold</Ui>, <Ui>Quorum</Ui>, <Ui>Settle early</Ui> and
		<Ui>Voting period</Ui> (1 to 90 days).
	</li>
</ul>
<Shot
	light={votingLight}
	dark={votingDark}
	alt="A choice's Voting section with Customize ballot and rule open: Secret ballot, Votes may change, Several options"
	caption="A choice's rule, customized. The last line works it out for this DAO."
/>
<p>See <a href="/docs/voting-rules">Voting Rules</a> for what each setting does.</p>
<h3 id="for-changes-to-the-dao">For Changes to the DAO</h3>
<p>The section shows the DAO's voting rules, which you cannot change here:</p>
<Shot
	light={daoRulesLight}
	dark={daoRulesDark}
	alt="Voting rules: open ballot, votes final once cast, two thirds of the whole vote, settles early, open 14 days"
	caption="A change to the DAO runs under the DAO's voting rules."
/>
<p>Members change them with a Voting rules proposal.</p>

<h2 id="create">Create</h2>
<Shot
	light={barLight}
	dark={barDark}
	alt="The bar along the bottom: If it passes, who votes, and Create proposal"
	caption="What passing would do, and who votes."
/>
<p>
	The bar says what happens <Ui>If it passes</Ui> and who votes, for example <Ui kind="message"
		>The vote opens for the 3 current members, the moment you sign.</Ui
	> Select <Ui>Create proposal</Ui>. Your key signs, the proposal page opens, and the vote is open.
</p>
<DocNote>
	<p>
		The members and units at the moment you sign are the proposal's electorate. Members who join
		later, or whose units change later, do not vote on it.
	</p>
</DocNote>
<p>Nobody can edit, withdraw or cancel a proposal once it is made. It runs until it is decided.</p>
<p>
	Creating a proposal is paid by the DAO's balance, or by you where each member pays. Where the DAO
	pays and its balance is empty, <Ui>New proposal</Ui> is not shown until someone tops it up. A party
	can make up to 30 proposals and comments an hour; beyond that the app says <Ui kind="message"
		>Too many requests. Try again in an hour.</Ui
	>
</p>
