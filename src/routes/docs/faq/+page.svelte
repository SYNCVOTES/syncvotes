<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
</script>

<h2 id="lost-phrase">I lost my recovery phrase. Can I get it back?</h2>
<p>
	No. Nobody, including SyncVotes, can recover it. If a device still keeps your key and you can
	unlock it, you can keep using your party there, but the app cannot show the phrase again.
</p>
<p>
	To be safe, create a new key and party, and ask each of your DAOs to add the new party and remove
	the old one with a Members or Shares proposal. Balances cannot be moved to the new party.
</p>

<h2 id="no-party">My restored key says there is no party on this network. What happened?</h2>
<p>The phrase is valid, but no party on this network was created with it. Usually one of these:</p>
<ul>
	<li>
		<strong>Another network.</strong> Your party is on another network. Check the network pill in the
		header, switch to the network where you created your party, and restore there.
	</li>
	<li>
		<strong>Another phrase.</strong> A valid phrase with a word swapped or out of order gives a
		different key. Select <Ui>Back</Ui> and check the words against what you wrote down.
	</li>
</ul>
<p>
	Only choose a party hint on that screen if you want a new party on this network. See
	<a href="/docs/create-a-wallet#restore-a-key">Restore a Key</a>.
</p>

<h2 id="vote-rejected">Why was my vote rejected?</h2>
<table>
	<thead><tr><th>Message</th><th>Why</th></tr></thead>
	<tbody>
		<tr>
			<td><Ui kind="message">The DAO's balance is empty. Top it up first.</Ui></td>
			<td>The DAO pays for ballots, and its balance has run out.</td>
		</tr>
		<tr>
			<td><Ui kind="message">Your balance is empty. Top up on the Wallet page.</Ui></td>
			<td>Each member pays in this DAO, and your balance has run out.</td>
		</tr>
		<tr>
			<td><Ui kind="message">You have no vote on this proposal</Ui></td>
			<td>
				The vote has closed or closes within 90 seconds, you joined or your units changed after the
				proposal was made, or you already voted and votes cannot change.
			</td>
		</tr>
		<tr>
			<td><Ui kind="message">You have already voted. Votes on this proposal are final.</Ui></td>
			<td>Your first ballot is already on the ledger.</td>
		</tr>
		<tr>
			<td><Ui kind="message">This changed since you opened it. Reload and try again.</Ui></td>
			<td>Something you were voting from changed a moment before you signed.</td>
		</tr>
		<tr>
			<td><Ui kind="message">Wallet locked. Unlock and try again.</Ui></td>
			<td>The key locked itself while you were voting.</td>
		</tr>
	</tbody>
</table>

<h2 id="not-executed">A proposal passed. Why is it not executed yet?</h2>
<ul>
	<li>
		<strong>It is a decision or a choice.</strong> These have nothing to execute. Their status stays
		<Ui>Passed</Ui> or <Ui>Decided</Ui>.
	</li>
	<li>
		<strong>It is being executed.</strong> The page says <Ui kind="message">Passed. Executing…</Ui>.
		A large membership change runs in batches of 200 and shows how far it got.
	</li>
	<li>
		<strong>Execution keeps failing.</strong> The page says <Ui kind="message">Not executed yet</Ui> with
		the reason. The app keeps retrying, up to every 15 minutes.
	</li>
</ul>
<p>
	The app executes what passed. If it is down or behind, execution waits. See
	<a href="/docs/voting-and-counting#execution">Voting and Counting</a>.
</p>

<h2 id="delete-comment">Can I edit or delete a comment?</h2>
<p>No. A comment is a contract on the ledger, kept as written. Nobody can edit or remove it.</p>

<h2 id="cancel-proposal">Can I cancel my proposal?</h2>
<p>No. A proposal runs until it is decided. Members can vote it down.</p>

<h2 id="leave-dao">Can I leave a DAO?</h2>
<p>
	Only by vote. A Members or Shares proposal that removes you has to pass under the DAO's voting
	rules. You can make that proposal yourself.
</p>

<h2 id="change-hint">Can I change my party hint?</h2>
<p>
	No. The party hint is part of your party ID, which never changes. You can set a display name in
	your profile instead, and change it whenever you like.
</p>

<h2 id="vote-private">Is my vote private?</h2>
<ul>
	<li>
		<strong>From other members:</strong> only on a secret ballot. On an open ballot, every member can
		see how you voted.
	</li>
	<li><strong>From readers of a public DAO:</strong> yes. They see only the totals.</li>
	<li>
		<strong>From the app:</strong> no. The app counts the ballots, so it sees every vote.
	</li>
	<li>
		<strong>From the rest of the Canton Network:</strong> yes. Other validators never receive the ballot.
	</li>
</ul>
<p>See <a href="/docs/secret-ballots">Secret Ballots</a>.</p>

<h2 id="cost">What does it cost?</h2>
<p>
	On TestNet and DevNet, nothing for now. On MainNet, every transaction is charged at the network's
	traffic price, less the rewards that come back. The Wallet page shows what creating a party costs
	before you start, and every balance shows the current price per MB. See
	<a href="/docs/balances-and-traffic">Balances and Traffic</a>.
</p>

<h2 id="where-coin-goes">Where does my coin go?</h2>
<p>
	To the validator operator's own party, the Address shown under <Ui>Top up</Ui>. Its wallet buys
	the traffic your transactions use. What you top up is spent on traffic and is not paid back.
</p>

<h2 id="cannot-see-dao">Why can't I see a DAO someone sent me?</h2>
<ul>
	<li>It is private and you are not a member. The page says <Ui>Members only</Ui>.</li>
	<li>It is on another network. Each network has its own DAOs.</li>
	<li>It was dissolved. Its page no longer opens.</li>
</ul>

<h2 id="does-app-hold-key">Does SyncVotes hold my key?</h2>
<p>
	No. Your key is made and kept in your browser. The server receives your public key and your
	signatures, never the key itself. See
	<a href="/docs/keys-and-parties">Keys and Parties</a>.
</p>
