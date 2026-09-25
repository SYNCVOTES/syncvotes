<script lang="ts">
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	A DAO is <strong>private</strong> unless it chooses to be <strong>public</strong>. The choice
	decides who can read it through SyncVotes. In both cases, only members can act.
</p>

<h2 id="who-can-do-what">Who Can Do What</h2>
<table>
	<thead><tr><th></th><th>Private DAO</th><th>Public DAO</th></tr></thead>
	<tbody>
		<tr><td>Listed on Public DAOs</td><td>No</td><td>Yes</td></tr>
		<tr
			><td>Read proposals, outcomes, members and comments</td><td>Members</td><td
				>Anyone signed in</td
			></tr
		>
		<tr><td>See who voted how</td><td>Members</td><td>Members</td></tr>
		<tr><td>Propose, vote and comment</td><td>Members</td><td>Members</td></tr>
		<tr><td>See the balance and how to top it up</td><td>Members</td><td>Anyone signed in</td></tr>
	</tbody>
</table>
<p>
	A signed-in reader of a public DAO sees the badge <strong>Reader</strong> and the line
	<strong>You're viewing a public DAO. See its description for how to join.</strong> Someone who
	opens a private DAO without being a member sees <strong>Members only</strong>.
</p>
<p>
	Anyone who knows the DAO's memo can send coin for it from any Canton wallet. A private DAO shows
	its address and memo to its members only.
</p>

<h2 id="joining">Joining a DAO</h2>
<p>There is no join button. Members decide who joins, by vote. To join a DAO, public or private:</p>
<ol>
	<li>Create your party on the same network as the DAO.</li>
	<li>Copy your party ID from the Wallet page and send it to a member.</li>
	<li>
		A member proposes a Members (or Shares) change that adds you, and it has to pass under the DAO's
		voting rules.
	</li>
</ol>
<p>Once it is executed, the DAO appears in your <strong>My DAOs</strong>.</p>

<h2 id="leaving">Leaving a DAO</h2>
<p>
	There is no leave button either. A member leaves when a Members or Shares proposal that removes
	them passes. You can propose your own removal like any other change.
</p>

<h2 id="changing-visibility">Changing Visibility</h2>
<p>
	A DAO is made public or private at creation, and later by a <strong>Visibility</strong> proposal. It
	runs under the DAO's voting rules. When it is executed, the DAO appears on or disappears from Public
	DAOs.
</p>

<h2 id="the-real-dao">How to Tell the Real DAO</h2>
<p>
	Anyone can create a DAO under any name and picture. A name on Public DAOs proves nothing about who
	runs it. To be sure you have the real DAO of an organization:
</p>
<ol>
	<li>Find the DAO ID on the organization's own site or channel.</li>
	<li>
		Compare it with the <strong>DAO ID</strong> shown on a public DAO's page. It is also the last
		part of the page's address, <code>/daos/&lt;DAO ID&gt;</code>. You can paste the ID into the
		search on Public DAOs, too.
	</li>
</ol>
<p>
	An organization that runs a public DAO should publish its DAO ID, or the link to its page, where
	its members already trust it.
</p>

<h2 id="what-the-rest-of-canton-sees">What the Rest of Canton Sees</h2>
<p>
	"Public" is about SyncVotes, not about the Canton Network. A public DAO is readable because the
	app shows it to anyone signed in. On the ledger, nothing changes:
</p>
<ul>
	<li>
		Every DAO's contracts, public or private, are stored by the app's validator, which hosts every
		party involved.
	</li>
	<li>
		Other validators never receive them. The synchronizer that orders the transactions sees only
		encrypted data.
	</li>
</ul>
<DocNote>
	<p>
		The app's operator can read every DAO, public or private, including its ballots. See
		<a href="/docs/trust-model">Trust Model</a>.
	</p>
</DocNote>

<h2 id="for-organizations">For Organizations</h2>
<p>If an organization uses SyncVotes for its governance:</p>
<ul>
	<li>
		Choose <strong>By shares</strong> when votes should follow ownership, and write the unit table so
		it matches your records. Units change only by vote.
	</li>
	<li>
		Choose <strong>The DAO pays</strong> to keep costs in one balance that anyone, including a treasury
		wallet, can top up.
	</li>
	<li>Publish the DAO ID where your members can check it.</li>
	<li>
		Read the <a href="/docs/trust-model">Trust Model</a> first: it lists what the app's operator can do,
		and which voting rules limit it.
	</li>
</ul>
