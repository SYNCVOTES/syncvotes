<p>
	SyncVotes is a governance app on the Canton Network. You use it to create a <strong>DAO</strong>,
	put proposals to its members and vote on them. Every DAO, proposal and ballot is a Daml contract
	on the ledger, and every transaction you make is signed by a key that stays in your browser.
</p>

<h2 id="who-it-is-for">Who It Is For</h2>
<p>SyncVotes fits any group that decides things together and wants the result on a ledger:</p>
<ul>
	<li>
		<strong>Groups where each member has one vote</strong>, such as a committee, a club or a
		collective. These DAOs vote by membership.
	</li>
	<li>
		<strong>Organizations where votes follow ownership</strong>, such as a company, a fund or a
		partnership. These DAOs vote by shares: members hold units of the vote (40 of 100, for example).
	</li>
	<li>
		<strong>Anyone who wants a decision to be binding</strong>, rather than recorded in a poll, a
		chat or a spreadsheet.
	</li>
</ul>

<h2 id="run-by-nobody">A DAO Run by Nobody</h2>
<p>
	A DAO on SyncVotes has no administrator. Everything that changes it is decided by a vote of its
	members and executed by the ledger:
</p>
<table>
	<thead><tr><th>What changes</th><th>How</th></tr></thead>
	<tbody>
		<tr><td>Who is in it, and with how many units</td><td>A Members or Shares proposal</td></tr>
		<tr><td>Its name, description and picture</td><td>A Name and description proposal</td></tr>
		<tr><td>How it votes on changes</td><td>A Voting rules proposal</td></tr>
		<tr><td>Who can read it</td><td>A Visibility proposal</td></tr>
		<tr><td>Whether it goes on</td><td>A Dissolve proposal</td></tr>
	</tbody>
</table>
<p>
	The person who creates a DAO is its <strong>creator</strong> and nothing more. After creation, they
	propose and vote like any other member. Nobody can edit a DAO by hand, and nobody can cancel a proposal
	once it is made.
</p>
<p>
	The app counts the ballots and submits what passed, and the ledger checks each step. The app can
	delay a result but cannot forge a ballot. See <a href="/docs/trust-model">Trust Model</a> for exactly
	what the app can and cannot do.
</p>

<h2 id="how-a-vote-works">How a Vote Works</h2>
<ol>
	<li>A member creates a proposal. The vote opens the moment they sign it.</li>
	<li>Members cast their ballots, each signed with the member's own key.</li>
	<li>
		The app hands the ballots to the ledger in batches. The ledger checks each ballot and keeps the
		count on the proposal.
	</li>
	<li>
		The proposal is decided as soon as the outcome can no longer change, or at the deadline,
		depending on its rules.
	</li>
	<li>
		If it passed and it changes the DAO, the app executes the change with the DAO's authority.
	</li>
</ol>

<h2 id="what-stays-on-your-device">What Stays on Your Device</h2>
<p>
	Your <strong>key</strong> is made from a 12-word recovery phrase in your browser. It is kept on your
	device, encrypted, and it never reaches the server. The server prepares each transaction, your browser
	checks that it does what you asked and signs it, and the server submits the signature to the ledger.
</p>
<p>
	On the ledger, you are a <strong>party</strong>: an identity hosted on the app's validator that
	only your key can sign for. See <a href="/docs/keys-and-parties">Keys and Parties</a>.
</p>

<h2 id="what-it-costs">What It Costs</h2>
<p>
	Every transaction on the Canton Network uses <strong>traffic</strong>, which is paid for in Canton
	Coin (CC). On MainNet, you or your DAO top up a balance with CC and each transaction is charged to
	it. The Wallet page tells you when a network charges nothing. See
	<a href="/docs/balances-and-traffic">Balances and Traffic</a>.
</p>

<h2 id="three-networks">Three Networks</h2>
<p>SyncVotes runs on three Canton networks, each as a site of its own:</p>
<table>
	<thead><tr><th>Network</th><th>Site</th><th>Use it for</th></tr></thead>
	<tbody>
		<tr><td>MainNet</td><td><code>syncvotes.com</code></td><td>Real decisions</td></tr>
		<tr><td>TestNet</td><td><code>test.syncvotes.com</code></td><td>Trying SyncVotes out</td></tr>
		<tr><td>DevNet</td><td><code>dev.syncvotes.com</code></td><td>Trying SyncVotes out</td></tr>
	</tbody>
</table>
<p>
	Nothing carries over between them: each has its own parties and DAOs. See
	<a href="/docs/networks">Networks</a>.
</p>

<h2 id="open-source">Open Source</h2>
<p>
	The app's code, including the Daml model that the ledger enforces, is on
	<a href="https://github.com/SYNCVOTES/syncvotes" rel="noopener">GitHub</a>. The
	<a href="/version" rel="external">Build</a> link in the footer shows the commit a site runs and the
	ID of the Daml package it uses, so you can match the running code against the source.
</p>
