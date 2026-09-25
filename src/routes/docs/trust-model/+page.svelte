<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	SyncVotes is not trustless. You rely on the app, and on whoever runs it, for some things and not
	for others. This page lists both, so you can decide what to use it for and which rules to choose.
</p>

<h2 id="who-is-involved">Who Is Involved</h2>
<table>
	<thead><tr><th>Who</th><th>What they hold</th></tr></thead>
	<tbody>
		<tr>
			<td>You</td>
			<td>Your key. Nothing is done as your party without its signature.</td>
		</tr>
		<tr>
			<td>The app's provider party</td>
			<td>
				Co-signs every contract you act on: accounts, DAOs, members, proposals, ballots, comments
				and profiles. It counts ballots, executes what passed, and keeps the balance records.
			</td>
		</tr>
		<tr>
			<td>The app's validator</td>
			<td>
				Hosts your party with confirmation rights and stores every contract of every DAO in the app.
			</td>
		</tr>
		<tr>
			<td>The Canton Network</td>
			<td>Orders transactions and runs the Daml model, which checks every step.</td>
		</tr>
	</tbody>
</table>
<p>
	The provider party signing every contract is what makes the provider confirm every transaction,
	which is how a featured app earns app rewards. It is also what lets it count and execute.
</p>

<h2 id="what-the-app-cannot-do">What the App Cannot Do</h2>
<ul>
	<li>
		<strong>Act as you.</strong> It cannot vote, propose, comment, create a DAO or set a profile in your
		name. Each of those needs your key's signature, and the app's ledger user has no right to act as your
		party.
	</li>
	<li>
		<strong>Forge or alter a ballot.</strong> A ballot carries your signature, and the ledger checks every
		ballot it is handed.
	</li>
	<li>
		<strong>Count a ballot the ledger refuses</strong>: one cast late, by a non-member, by a member
		who joined or changed units after the proposal was made, or counted before.
	</li>
	<li>
		<strong>Change a DAO by hand.</strong> It can only execute a proposal that passed, and only the change
		that proposal carries.
	</li>
	<li>
		<strong>Invent a member or a proposal.</strong> Members need the DAO creator's signature as well as
		the provider's, and a proposal needs its proposer's.
	</li>
	<li>
		<strong
			>Pass a decision or a change to the DAO measured against the whole vote by leaving ballots
			out.</strong
		> Leaving ballots out only lowers the yes count against a fixed total.
	</li>
</ul>

<h2 id="what-the-app-can-do">What the App Can Do</h2>
<ul>
	<li>
		<strong>See everything.</strong> It reads every DAO, public or private, and every ballot, including
		secret ones.
	</li>
	<li>
		<strong>Delay.</strong> It chooses when to count and when to execute. It can hold a result back, or
		not execute a change that passed.
	</li>
	<li>
		<strong>Refuse service.</strong> It can refuse to prepare your transactions. If the validator is down,
		nothing of yours moves.
	</li>
	<li>
		<strong>Make a proposal fail</strong> by leaving yes ballots out of the count.
	</li>
	<li>
		<strong>Flip a result either way</strong> where the rule counts votes cast, by leaving out the ballots
		that go against the result it wants.
	</li>
	<li>
		<strong>Make a quorum fail</strong> by leaving out enough ballots, whatever the basis.
	</li>
	<li>
		<strong>Break a tie on a choice</strong> with one pick, by leaving out ballots for one of the tied
		options.
	</li>
	<li>
		<strong>Skip a member in a membership change.</strong> When it executes a Members or Shares change,
		it hands the ledger the affected members' contracts. If it leaves one out, a removal is skipped, or
		a member ends up with a second membership and a second vote. The ledger cannot tell a missing membership
		from a withheld one, but either shows on the ledger: two memberships for one party, or one that should
		be gone.
	</li>
	<li>
		<strong>Write the balances.</strong> The records of what was topped up and spent are signed by the
		provider alone.
	</li>
	<li>
		<strong>Lose the data.</strong> Every contract of every DAO is stored on the app's validator, because
		it hosts every party involved. If that validator's data is lost or wiped, the DAOs go with it.
	</li>
</ul>
<DocNote title="Choosing rules with this in mind">
	<p>
		For changes that matter, measure yes against the whole vote. The app can then only delay a
		change or make it fail, never pass it. The default DAO voting rules, Two thirds of the vote,
		work this way.
	</p>
</DocNote>

<h2 id="the-final-count">The Final Count</h2>
<p>
	The ledger checks every ballot the app hands in, but it cannot see ballots the app did not hand
	in. When the app says that the last batch after the deadline is final, the ledger takes its word
	and decides the proposal. This is the one statement the ledger accepts from the app unchecked.
	Together with the app choosing which ballots to hand in, it is where the limits above come from.
</p>

<h2 id="verification">Verification in Your Browser</h2>
<p>
	Your browser checks every transaction before your key signs it. It recomputes the hash, and it
	refuses anything that does not act as you alone, is not one of the five actions you can take, uses
	another Daml package, targets another contract, or carries other arguments than the page built. At
	sign-up, it checks that your key is the only key that can sign for your party and that the
	validator gets confirmation rights only. See
	<a href="/docs/keys-and-parties#verify-before-signing">Keys and Parties</a>.
</p>
<p>
	These checks run in code the site serves you. To trust them, you trust that the site serves the
	published code.
</p>

<h2 id="open-source">Open Source and What Runs</h2>
<p>
	The code is on <a href="https://github.com/SYNCVOTES/syncvotes" rel="noopener">GitHub</a>,
	including the Daml model that the ledger enforces. Each site answers at
	<a href="/version" rel="external"><code>/version</code></a> (the <Ui>Build</Ui> link in the footer)
	with two lines:
</p>
<ul>
	<li><code>commit</code>: the commit the site was built from. A site only runs committed code.</li>
	<li>
		<code>package</code>: the name and ID of the Daml package the app uploaded to its validator. The
		ID is what the validator knows the code by, so it can be matched against a build of that commit.
	</li>
</ul>
