<script lang="ts">
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	Every transaction on the Canton Network costs <strong>traffic</strong>, which is Canton's term for
	transaction fees. The app's validator buys traffic with Canton Coin (CC). SyncVotes charges what
	each transaction cost to a balance, which you top up by sending CC to the app's address.
</p>

<h2 id="why-it-costs">Why It Costs</h2>
<p>
	A transaction's traffic depends on its size in bytes. Creating your party, creating a DAO, a
	proposal, a ballot, a comment, counting and executing are all transactions. Reading is free:
	opening a page costs nothing.
</p>
<p>
	A DAO holds no coin itself. Its balance is the app's record of what was topped up for it and what
	its transactions have cost so far.
</p>

<h2 id="two-kinds-of-balance">Two Kinds of Balance</h2>
<table>
	<thead><tr><th>Balance</th><th>Where you see it</th><th>Pays for</th></tr></thead>
	<tbody>
		<tr>
			<td>Your own</td>
			<td>The Wallet page</td>
			<td>
				Creating your party, your profile, the DAOs you create, and what you do in DAOs where each
				member pays
			</td>
		</tr>
		<tr>
			<td>A DAO's</td>
			<td>The DAO page, under <strong>Balance</strong></td>
			<td>Everything done in a DAO where the DAO pays</td>
		</tr>
	</tbody>
</table>
<p>Each balance shows three figures and the price:</p>
<ul>
	<li><strong>Topped up</strong>: all the CC credited to it so far.</li>
	<li><strong>Spent</strong>: what its transactions have cost.</li>
	<li><strong>Available</strong>: the difference, which is what you can still spend.</li>
	<li><strong>Price</strong>: what a megabyte of traffic costs right now, in CC.</li>
</ul>

<h2 id="who-pays">Who Pays for What</h2>
<table>
	<thead><tr><th>Transaction</th><th>The DAO pays</th><th>Each member pays</th></tr></thead>
	<tbody>
		<tr><td>Creating your party</td><td colspan="2">You</td></tr>
		<tr><td>Your profile</td><td colspan="2">You</td></tr>
		<tr
			><td>Creating a DAO, and adding its founding members</td><td
				>You, then the DAO for the batches after the first 200</td
			><td>You</td></tr
		>
		<tr><td>A proposal</td><td>The DAO</td><td>The proposer</td></tr>
		<tr><td>A ballot</td><td>The DAO</td><td>The voter</td></tr>
		<tr><td>A comment</td><td>The DAO</td><td>The author</td></tr>
		<tr><td>Counting and executing a proposal</td><td>The DAO</td><td>The proposer</td></tr>
	</tbody>
</table>
<p>
	Before your key signs, the app asks the validator what the transaction will cost and checks that
	the balance covers it. If it does not, you see a message such as
	<strong>This costs about 0.40 CC; your balance is 0.12 CC. Top up first.</strong> Counting and executing
	are not stopped this way, so a balance can go below zero. The next top-up covers that first.
</p>
<p>
	Where the DAO pays and its balance is empty, the DAO page says
	<strong>The DAO's balance is empty. Top it up to act.</strong> and nobody can propose, vote or comment
	until someone does.
</p>

<h2 id="top-up">Top Up</h2>
<ol>
	<li>
		Open <strong>Top up</strong> under the balance: on the Wallet page for your own, on the DAO page for
		a DAO's.
	</li>
	<li>
		Copy the <strong>Address</strong>. It is the party of the app's validator, whose wallet buys the
		traffic.
	</li>
	<li>
		Copy the <strong>Memo</strong>. It names the balance to credit: <code>syncvotes:</code> followed by
		your key's fingerprint, or by the DAO's ID.
	</li>
	<li>
		From any Canton wallet, send CC to the Address, with the Memo exactly as shown in the transfer's
		memo or reason field.
	</li>
</ol>
<p>
	The app checks for new transfers every 20 seconds and credits the balance named in the memo. The
	figure it shows is read from the ledger.
</p>
<DocNote tone="warn" title="The memo is required">
	<p>
		A transfer without the memo, or with a memo that does not match exactly, is not credited to any
		balance, and the app cannot match it later.
	</p>
</DocNote>
<p>
	Anyone can top up any balance: a member can top up their DAO, and a reader can top up a public
	DAO. Topping up changes nothing about voting power.
</p>

<h2 id="price">The Price per MB</h2>
<p>
	The network publishes a price for traffic, in US dollars per megabyte. The app turns it into CC at
	the current coin price, then subtracts what comes back as rewards:
</p>
<ul>
	<li>
		<strong>The validator's rebate.</strong> The network mints the validator a share of the coin it spends
		on traffic. The app reads the current share from Scan, the network's public service for Canton Coin
		data.
	</li>
	<li>
		<strong>App rewards by traffic.</strong> Where SyncVotes is a featured app, the network pays app rewards
		by traffic, and the app's traffic is large enough to earn them, those rewards are subtracted too.
	</li>
</ul>
<p>
	Example: the network's price is $60 per MB and 1 CC is worth $0.15. A megabyte costs 400 CC. With
	a validator rebate of 0.2 and no app rewards, the price shown is 320 CC per MB. A transaction of
	2,000 bytes then costs 0.64 CC.
</p>
<h3 id="activity-markers">Activity Markers</h3>
<p>
	Where the network rewards featured apps by <strong>activity marker</strong> instead, the app can record
	one marker with each piece of its activity: creating a DAO, a proposal or a vote, and executing a change.
	Such a transaction is charged less what its marker brings. The price per MB shown does not include this,
	so these transactions cost less than the price suggests.
</p>
<p>
	All these inputs move with the network, so the price moves too. The app reads the prices about
	every minute and the rewards every 10 minutes. Each transaction is charged at the price of the
	moment it lands.
</p>
<DocNote tone="operator" title="For operators">
	<p>
		The app multiplies the net price by <code>BILLING_FACTOR</code> (1 by default; below 1 the
		validator subsidizes traffic, and 0 makes it free). <code>BILLING_FLOOR</code> sets the least a
		payer is charged, as a fraction of the network's price, even when rewards cover the whole cost
		(none by default). <code>MARKERS=true</code> records activity markers where the provider is featured.
	</p>
</DocNote>

<h2 id="free-networks">Where Traffic Is Free</h2>
<p>
	Where the app charges nothing, as on TestNet and DevNet today, no balance is needed. The Wallet
	page says <strong>Creating a party is free on this network.</strong>, balances read
	<strong>Transactions are free on this network for now.</strong>, and nothing asks you to top up.
</p>

<h2 id="no-refunds">No Refunds</h2>
<p>What you top up is spent on traffic. It is not paid back:</p>
<ul>
	<li>a balance cannot be withdrawn or moved to another balance;</li>
	<li>what is left when a DAO is dissolved is lost;</li>
	<li>coin sent without a memo stays with the validator.</li>
</ul>

<h2 id="where-coin-goes">Where Your Coin Goes</h2>
<p>
	The Address is the validator operator's own party. Its wallet buys the traffic that SyncVotes
	transactions use. App rewards, where the network pays them, arrive at the app's provider party,
	and every hour the app moves them on to the same wallet, keeping a small float for its own fees.
</p>
