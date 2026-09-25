<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import DocNote from '$lib/components/doc-note.svelte';
	import votesLight from '$lib/assets/docs/dao-create-votes-light.webp';
	import votesDark from '$lib/assets/docs/dao-create-votes-dark.webp';
	import paysLight from '$lib/assets/docs/dao-create-pays-light.webp';
	import paysDark from '$lib/assets/docs/dao-create-pays-dark.webp';
	import rulesLight from '$lib/assets/docs/dao-create-rules-light.webp';
	import rulesDark from '$lib/assets/docs/dao-create-rules-dark.webp';
	import membersLight from '$lib/assets/docs/dao-create-members-light.webp';
	import membersDark from '$lib/assets/docs/dao-create-members-dark.webp';
	import summaryLight from '$lib/assets/docs/dao-create-summary-light.webp';
	import summaryDark from '$lib/assets/docs/dao-create-summary-dark.webp';
	import headerLight from '$lib/assets/docs/dao-header-light.webp';
	import headerDark from '$lib/assets/docs/dao-header-dark.webp';
</script>

<p>
	You create a DAO on one page with six numbered sections. Open it from <Ui>My DAOs</Ui> with
	<Ui>Create DAO</Ui>. A summary of what you are about to sign sits beside the form, or in a bar
	along the bottom on a phone.
</p>
<DocNote title="Two choices are final">
	<p>
		Sections marked <Ui kind="message">can't be changed later</Ui> (<Ui>How it votes</Ui> and
		<Ui>Who pays</Ui>) are fixed once the DAO exists. Everything else changes only by a vote of the
		members.
	</p>
</DocNote>

<h2 id="basics">01 Basics</h2>
<table>
	<thead><tr><th>Field</th><th>What to enter</th></tr></thead>
	<tbody>
		<tr><td><Ui>Name</Ui></td><td>2 to 60 characters.</td></tr>
		<tr>
			<td><Ui>Description</Ui></td>
			<td>
				What the DAO is for, in Markdown, up to 10,000 characters. <Ui>Preview</Ui> shows how it will
				read. Optional.
			</td>
		</tr>
		<tr>
			<td><Ui>Picture</Ui></td>
			<td
				>An <code>https</code> link to an image. The ledger keeps the link, not the image. Optional.</td
			>
		</tr>
	</tbody>
</table>

<h2 id="how-it-votes">02 How It Votes</h2>
<Shot
	light={votesLight}
	dark={votesDark}
	alt="How it votes: By membership or By shares"
	caption="How it votes. Chosen once, for good."
/>
<ul>
	<li>
		<Ui>By membership</Ui>: every member holds one unit, so one member has one vote.
	</li>
	<li>
		<Ui>By shares</Ui>: each member holds a whole number of units, and their
		<Ui kind="term">voting power</Ui> is their units over the total. If Alice holds 40 units, Bob 35 and
		Carol 25, the whole vote is 100 units and Alice has 40%.
	</li>
</ul>
<p>Units change only by a Shares proposal. Topping up a balance never changes them.</p>

<h2 id="who-can-see-it">03 Who Can See It</h2>
<ul>
	<li><Ui>Private</Ui>: only its members see it exists.</li>
	<li>
		<Ui>Public</Ui>: listed on <Ui>Public DAOs</Ui>. Anyone signed in can read its proposals,
		outcomes, members and comments, and top up its balance. Only members act, and only members see
		the ballots.
	</li>
</ul>
<p>
	A Visibility proposal changes this later. In a public DAO, say in the description how to join. See
	<a href="/docs/public-and-private-daos">Public and Private DAOs</a>.
</p>

<h2 id="who-pays">04 Who Pays</h2>
<Shot
	light={paysLight}
	dark={paysDark}
	alt="Who pays: The DAO pays or Each member pays"
	caption="Who pays. Also chosen once."
/>
<ul>
	<li>
		<Ui>The DAO pays</Ui>: one shared balance pays for everything done in the DAO, and anyone can
		top it up. When it is empty, nobody can act in the DAO until someone does.
	</li>
	<li>
		<Ui>Each member pays</Ui>: each member pays for their own actions from their Wallet balance, and
		the proposer also pays for counting and executing their proposal.
	</li>
</ul>
<p>
	Either way, <Ui kind="message">Creating the DAO is charged to you.</Ui> Where the network charges nothing,
	the summary says <Ui kind="message">Free on this network.</Ui> See
	<a href="/docs/balances-and-traffic">Balances and Traffic</a>.
</p>

<h2 id="voting-rules">05 Voting Rules</h2>
<p>
	The voting rules apply to every change to the DAO: members and shares, name, description and
	picture, the rules themselves, visibility and dissolving. Decisions and choices use a rule their
	proposer sets.
</p>
<p>
	<Ui>Preset</Ui> starts on <Ui>Two thirds of the vote</Ui>: open ballot, votes final once cast,
	settling early, open 14 days. <Ui>Customize ballot and rule</Ui> opens every setting. The line at the
	bottom says what the rule means for this DAO's members as the form stands.
</p>
<Shot
	light={rulesLight}
	dark={rulesDark}
	alt="Voting rules with Customize ballot and rule open, and the line that says what the rule means in this DAO"
	caption="The voting rules, customized. With 2 founding members, two thirds means 2 of 2."
/>
<p>
	Each setting is explained in <a href="/docs/voting-rules">Voting Rules</a>. Later, members change
	the rules with a Voting rules proposal, which passes under the rules in force.
</p>

<h2 id="founding-members">06 Members</h2>
<p>
	The last section is <Ui>Members</Ui> in a DAO by membership and <Ui>Shares</Ui> in a DAO by shares.
	You are already in the list and cannot take yourself out. To add others:
</p>
<ul>
	<li>type or paste party IDs into <Ui>Add party IDs</Ui>;</li>
	<li>
		or select <Ui>Paste list</Ui>, paste one party ID per line (by shares: the party ID, then its
		units) and select <Ui>Add</Ui>.
	</li>
</ul>
<Shot
	light={membersLight}
	dark={membersDark}
	alt="The founding members list: nina and omar, with Add party IDs and Paste list above"
	caption="Founding members, with the creator first."
/>
<p>
	Every founding member needs a party on this network already. The app checks each ID; one that is
	not registered with SyncVotes here is marked and cannot be added. By shares, every member needs at
	least 1 unit, and <Ui>Equal units</Ui> gives everyone the same number.
</p>
<p>
	A DAO can start with up to 2,000 members. The first 200 join the moment you sign. The rest are
	added in batches of 200 right after, while the DAO page shows <Ui kind="message"
		>Adding founding members…</Ui
	>. Those batches are paid by the DAO's balance, or by you where each member pays.
</p>

<h2 id="create">Create</h2>
<Shot
	light={summaryLight}
	dark={summaryDark}
	alt="The summary: name, how it votes, who pays, the rule, founding members, and Create DAO"
	caption="The summary and Create DAO."
/>
<p>
	Select <Ui>Create DAO</Ui>. Your key signs one transaction and the DAO page opens, tagged with its
	visibility, how it votes, and <Ui>Creator</Ui> for you.
</p>
<Shot
	light={headerLight}
	dark={headerDark}
	alt="A new DAO's page header with the Private, By membership and Creator tags"
	caption="The DAO page. New proposal is where every change starts."
/>

<h2 id="what-cannot-change">What Changes Later, and How</h2>
<table>
	<thead><tr><th>Setting</th><th>Later</th></tr></thead>
	<tbody>
		<tr><td>How it votes</td><td>Fixed</td></tr>
		<tr><td>Who pays</td><td>Fixed</td></tr>
		<tr><td>The DAO ID and its creator</td><td>Fixed</td></tr>
		<tr><td>Members and units</td><td>A Members or Shares proposal</td></tr>
		<tr><td>Name, description and picture</td><td>A Name and description proposal</td></tr>
		<tr><td>Voting rules</td><td>A Voting rules proposal</td></tr>
		<tr><td>Public or private</td><td>A Visibility proposal</td></tr>
		<tr><td>Whether it exists</td><td>A Dissolve proposal</td></tr>
	</tbody>
</table>
