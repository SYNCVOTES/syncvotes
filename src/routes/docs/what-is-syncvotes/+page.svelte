<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import proposalsLight from '$lib/assets/docs/dao-proposals-light.webp';
	import proposalsDark from '$lib/assets/docs/dao-proposals-dark.webp';
</script>

<p>
	SyncVotes is a governance app on the Canton Network. You create a <Ui kind="term">DAO</Ui>, put
	proposals to its members and vote on them. Every DAO, proposal and ballot is a Daml contract on
	the ledger, and every transaction you make is signed by a key that stays in your browser.
</p>

<h2 id="who-it-is-for">Who It Is For</h2>
<ul>
	<li>
		<strong>Groups where each member has one vote</strong>, such as a committee, a club or a
		collective. These DAOs vote <Ui>By membership</Ui>.
	</li>
	<li>
		<strong>Organizations where votes follow ownership</strong>, such as a company, a fund or a
		partnership. These DAOs vote <Ui>By shares</Ui>: members hold units of the vote (40 of 100, for
		example).
	</li>
	<li>
		<strong>Anyone who wants a decision on record</strong>, rather than in a chat poll or a
		spreadsheet.
	</li>
</ul>

<h2 id="run-by-nobody">A DAO Run by Nobody</h2>
<p>
	A DAO has no administrator. Everything that changes it is decided by a vote of its members, and
	the app then executes it on the ledger:
</p>
<table>
	<thead><tr><th>What changes</th><th>Proposal type</th></tr></thead>
	<tbody>
		<tr
			><td>Who is in it, and with how many units</td><td><Ui>Members</Ui> or <Ui>Shares</Ui></td
			></tr
		>
		<tr><td>Its name, description and picture</td><td><Ui>Name and description</Ui></td></tr>
		<tr><td>How it votes on changes</td><td><Ui>Voting rules</Ui></td></tr>
		<tr><td>Who can read it</td><td><Ui>Visibility</Ui></td></tr>
		<tr><td>Whether it goes on</td><td><Ui>Dissolve</Ui></td></tr>
	</tbody>
</table>
<p>
	The person who creates a DAO carries the <Ui>Creator</Ui> tag and nothing more: after creation they
	propose and vote like any other member. Nobody edits a DAO by hand, and nobody can withdraw a proposal
	once it is made.
</p>
<Shot
	light={proposalsLight}
	dark={proposalsDark}
	alt="A DAO's proposal list with Open, Decided and Executed badges and the filter tabs"
	caption="A DAO's proposals: open ones, decided choices, and an executed membership change."
/>

<h2 id="how-a-vote-works">How a Vote Works</h2>
<ol>
	<li>A member creates a proposal. The vote opens the moment they sign it.</li>
	<li>Members vote, each ballot signed with the member's own key.</li>
	<li>
		The app hands the ballots to the ledger in batches. The ledger checks each one and keeps the
		count on the proposal.
	</li>
	<li>
		The proposal is decided as soon as the outcome can no longer change, or at the deadline,
		depending on its rule.
	</li>
	<li>If it passed and changes the DAO, the app executes the change with the DAO's authority.</li>
</ol>
<p>
	The app can delay a result but cannot forge a ballot. <a href="/docs/trust-model">Trust Model</a>
	lists exactly what it can and cannot do.
</p>

<h2 id="what-stays-on-your-device">What Stays on Your Device</h2>
<p>
	Your <Ui kind="term">key</Ui> is made from a 12-word recovery phrase in your browser and never reaches
	the server. The server prepares each transaction, your browser checks it and signs it, and the server
	submits it with your signature. On the ledger you are a <Ui kind="term">party</Ui>, hosted on the
	app's validator, that only your key can sign for. See
	<a href="/docs/keys-and-parties">Keys and Parties</a>.
</p>

<h2 id="what-it-costs">What It Costs</h2>
<p>
	Every transaction uses Canton network <Ui kind="term">traffic</Ui>, paid in Canton Coin (CC).
	Where a network charges for it, you or your DAO top up a balance and each transaction is charged
	to it. On DevNet and TestNet SyncVotes charges nothing for now, and the app says so where a
	balance would be. See <a href="/docs/balances-and-traffic">Balances and Traffic</a>.
</p>

<h2 id="three-networks">Three Networks</h2>
<table>
	<thead><tr><th>Network</th><th>Site</th></tr></thead>
	<tbody>
		<tr><td>MainNet</td><td><code>syncvotes.com</code></td></tr>
		<tr><td>TestNet</td><td><code>test.syncvotes.com</code></td></tr>
		<tr><td>DevNet</td><td><code>dev.syncvotes.com</code></td></tr>
	</tbody>
</table>
<p>
	Each is a site of its own, with its own parties and DAOs; nothing carries over. See
	<a href="/docs/networks">Networks</a>.
</p>

<h2 id="open-source">Open Source</h2>
<p>
	The code, including the Daml model the ledger enforces, is on
	<a href="https://github.com/SYNCVOTES/syncvotes" rel="noopener">GitHub</a>. The
	<Ui>Build</Ui> link in the footer opens
	<a href="/version" rel="external"><code>/version</code></a>, which names the commit the site runs
	and the ID of its Daml package.
</p>
