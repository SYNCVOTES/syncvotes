<script lang="ts">
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	You create a DAO on one page, in six sections. Open it from <strong>My DAOs</strong> with
	<strong>Create DAO</strong>. The summary beside the form (at the bottom on a phone) shows what you
	are about to sign.
</p>
<DocNote title="Some choices are final">
	<p>
		<strong>How it votes</strong> and <strong>Who pays</strong> cannot be changed after creation. Everything
		else changes only by a vote of the members.
	</p>
</DocNote>

<h2 id="basics">Basics</h2>
<table>
	<thead><tr><th>Field</th><th>What to enter</th></tr></thead>
	<tbody>
		<tr><td>Name</td><td>2 to 60 characters.</td></tr>
		<tr
			><td>Description</td><td
				>What the DAO is for, in Markdown, up to 10,000 characters. Optional.</td
			></tr
		>
		<tr
			><td>Picture</td><td
				>An <code>https</code> link to an image. The ledger keeps the link, not the image. Optional.</td
			></tr
		>
	</tbody>
</table>
<p>
	If the DAO is public, say in the description how people can join. Anyone can create a DAO under
	any name, so an organization should point to its real DAO from its own site. See
	<a href="/docs/public-and-private-daos">Public and Private DAOs</a>.
</p>

<h2 id="how-it-votes">How It Votes</h2>
<table>
	<thead><tr><th>Choice</th><th>How votes count</th><th>Suits</th></tr></thead>
	<tbody>
		<tr>
			<td>By membership</td>
			<td>Each member holds one unit, so one member has one vote.</td>
			<td>A club, a committee, a collective</td>
		</tr>
		<tr>
			<td>By shares</td>
			<td>
				Each member holds a whole number of units. Your <strong>voting power</strong> is your units over
				the total.
			</td>
			<td>A company, a fund, a partnership</td>
		</tr>
	</tbody>
</table>
<p>
	For example, in a DAO by shares where Alice holds 40 units, Bob 35 and Carol 25, the whole vote is
	100 units and Alice's voting power is 40%. Units change only by a Shares proposal. Topping up a
	balance never changes them.
</p>

<h2 id="who-can-see-it">Who Can See It</h2>
<ul>
	<li>
		<strong>Private</strong>: only members see the DAO. Nothing about it is listed anywhere.
	</li>
	<li>
		<strong>Public</strong>: listed on Public DAOs. Anyone signed in can read its proposals,
		outcomes, members and comments, and top up its balance. Only members can propose, vote or
		comment, and only members see who voted how.
	</li>
</ul>
<p>You can change this later with a Visibility proposal.</p>

<h2 id="who-pays">Who Pays</h2>
<p>
	Every transaction in the DAO uses network traffic. This choice decides whose balance pays for it:
</p>
<table>
	<thead><tr><th>Choice</th><th>Who pays</th></tr></thead>
	<tbody>
		<tr>
			<td>The DAO pays</td>
			<td>
				One shared balance pays for everything done in the DAO. Anyone can top it up. When it is
				empty, nobody can act in the DAO until someone does.
			</td>
		</tr>
		<tr>
			<td>Each member pays</td>
			<td>
				Each member pays for what they sign from their own balance on the Wallet page. The proposer
				also pays for counting and executing their proposal.
			</td>
		</tr>
	</tbody>
</table>
<p>
	Creating the DAO is charged to your own balance either way. Where the network charges nothing, the
	summary says <strong>Free on this network</strong>. See
	<a href="/docs/balances-and-traffic">Balances and Traffic</a>.
</p>

<h2 id="voting-rules">Voting Rules</h2>
<p>
	The voting rules apply to every change to the DAO: its members and shares, its name, description
	and picture, these rules, its visibility, and dissolving it. Decisions and choices change nothing
	on the ledger, so whoever proposes one sets its rule.
</p>
<p>
	Pick a <strong>Preset</strong>, or open <strong>Customize ballot and rule</strong> to set each
	part. The default is <strong>Two thirds of the vote</strong>, with an open ballot, votes final
	once cast, settling early, and a 14-day voting period. The line under the settings works the rule
	out for your DAO. For 5 founding members it reads:
</p>
<p><code>In this DAO: 4 of 5 members must say yes.</code></p>
<p>
	Every setting is explained in <a href="/docs/voting-rules">Voting Rules</a>. To change the rules
	later, members pass a Voting rules proposal under the rules in force.
</p>

<h2 id="founding-members">Founding Members</h2>
<p>
	The last section is <strong>Members</strong> (by membership) or <strong>Shares</strong> (by shares).
	You are already in the list and cannot remove yourself. To add others:
</p>
<ul>
	<li>type or paste party IDs into <strong>Add party IDs</strong>;</li>
	<li>
		or select <strong>Paste list</strong> and paste one party ID per line (by shares: the party ID,
		then its units), then select <strong>Add</strong>.
	</li>
</ul>
<p>
	Every founding member needs a party on this network already. The app checks each party ID, and one
	that is not registered with SyncVotes here cannot be added. In a DAO by shares, each member needs
	at least 1 unit, and
	<strong>Equal units</strong> gives everyone the same number.
</p>
<p>
	A DAO can start with up to 2,000 members. The first 200 join the moment you sign. The rest are
	added right after, in batches of 200, and the DAO page shows
	<strong>Adding founding members…</strong> until they are all in. The batches are paid by the DAO's balance,
	or by you where each member pays.
</p>

<h2 id="create">Create</h2>
<p>
	Select <strong>Create DAO</strong>. Your key signs one transaction, and the DAO page opens. From
	then on, the DAO changes only by vote. See
	<a href="/docs/create-a-proposal">Create a Proposal</a>.
</p>

<h2 id="what-cannot-change">What Cannot Change Later</h2>
<table>
	<thead><tr><th>Setting</th><th>Later</th></tr></thead>
	<tbody>
		<tr><td>How it votes (by membership or by shares)</td><td>Fixed</td></tr>
		<tr><td>Who pays</td><td>Fixed</td></tr>
		<tr><td>The DAO ID and its creator</td><td>Fixed</td></tr>
		<tr><td>Members and units</td><td>By a Members or Shares proposal</td></tr>
		<tr><td>Name, description and picture</td><td>By a Name and description proposal</td></tr>
		<tr><td>Voting rules</td><td>By a Voting rules proposal</td></tr>
		<tr><td>Public or private</td><td>By a Visibility proposal</td></tr>
		<tr><td>Whether it exists</td><td>By a Dissolve proposal</td></tr>
	</tbody>
</table>
