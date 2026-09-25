<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import DocNote from '$lib/components/doc-note.svelte';
	import publicLight from '$lib/assets/docs/public-daos-light.webp';
	import publicDark from '$lib/assets/docs/public-daos-dark.webp';
	import readerLight from '$lib/assets/docs/dao-reader-light.webp';
	import readerDark from '$lib/assets/docs/dao-reader-dark.webp';
	import idLight from '$lib/assets/docs/dao-id-light.webp';
	import idDark from '$lib/assets/docs/dao-id-dark.webp';
</script>

<p>
	A DAO is <Ui>Private</Ui> unless it chooses to be <Ui>Public</Ui>. The choice decides who can read
	it through SyncVotes. Either way, only members act.
</p>

<h2 id="who-can-do-what">Who Can Do What</h2>
<table>
	<thead><tr><th></th><th>Private DAO</th><th>Public DAO</th></tr></thead>
	<tbody>
		<tr><td>Listed on Public DAOs</td><td>No</td><td>Yes</td></tr>
		<tr>
			<td>Read its proposals, outcomes, members and comments</td>
			<td>Members</td>
			<td>Anyone signed in</td>
		</tr>
		<tr><td>See the ballots</td><td>Members</td><td>Members</td></tr>
		<tr><td>Propose, vote and comment</td><td>Members</td><td>Members</td></tr>
		<tr><td>See the balance and how to top it up</td><td>Members</td><td>Anyone signed in</td></tr>
	</tbody>
</table>

<h2 id="public-daos">Public DAOs</h2>
<p>
	<Ui>Public DAOs</Ui> in the header lists every public DAO on this network, <Ui>Biggest</Ui> or
	<Ui>Newest</Ui> first. Search by name, description or DAO ID.
</p>
<Shot
	light={publicLight}
	dark={publicDark}
	alt="Public DAOs: the search field and a DAO card"
	caption="Public DAOs, searchable by name, description or DAO ID."
/>
<p>
	Opening a public DAO you are not in shows it with a <Ui>Reader</Ui> tag and the line
	<Ui kind="message">You're viewing a public DAO. See its description for how to join.</Ui> Its proposal
	pages show the totals and <Ui kind="message">Only members see ballots.</Ui>
</p>
<Shot
	light={readerLight}
	dark={readerDark}
	alt="A public DAO seen by a non-member: the Reader tag and You're viewing a public DAO"
	caption="A public DAO, seen by someone who is not a member."
/>
<p>
	Opening a private DAO you are not in shows <Ui>Members only</Ui> and your party ID, to send to a member.
</p>

<h2 id="joining">Joining a DAO</h2>
<p>There is no join button: members decide who joins, by vote. To join a DAO, public or private:</p>
<ol>
	<li>Create your party on the same network as the DAO.</li>
	<li>Copy your party ID from the Wallet page and send it to a member.</li>
	<li>
		A member proposes a Members (or Shares) change that adds you. On the DAO's members page,
		<Ui>Propose a change</Ui> opens that form. It has to pass under the DAO's voting rules.
	</li>
</ol>
<p>Once it is executed, the DAO appears in your <Ui>My DAOs</Ui>.</p>

<h2 id="leaving">Leaving a DAO</h2>
<p>
	There is no leave button either. A member leaves when a Members or Shares proposal that removes
	them passes. You can propose your own removal like any other change.
</p>

<h2 id="changing-visibility">Changing Visibility</h2>
<p>
	A DAO is made public or private when it is created, and later by a <Ui>Visibility</Ui> proposal under
	its voting rules. Once executed, the DAO appears on or leaves Public DAOs.
</p>

<h2 id="the-real-dao">How to Tell the Real DAO</h2>
<p>
	Anyone can create a DAO under any name and picture, as the Public DAOs page reminds you. A name
	proves nothing about who runs a DAO. To check you have an organization's real DAO:
</p>
<ol>
	<li>Find its DAO ID on the organization's own site or channel.</li>
	<li>
		Compare it with the <Ui>DAO ID</Ui> at the bottom of a public DAO's page, or with the end of the page's
		address, <code>/app/daos/&lt;DAO ID&gt;</code>. Pasting the ID into the Public DAOs search finds
		the DAO too.
	</li>
</ol>
<Shot
	light={idLight}
	dark={idDark}
	alt="The side column of a public DAO, ending with its DAO ID and a copy button"
	caption="A public DAO's ID, at the bottom of its side column."
/>
<p>
	An organization that runs a public DAO should publish its DAO ID where its members already trust
	it.
</p>

<h2 id="what-the-rest-of-canton-sees">What the Rest of Canton Sees</h2>
<p>
	"Public" is about SyncVotes, not the Canton Network. A public DAO is readable because the app
	shows it to anyone signed in. On the ledger nothing changes:
</p>
<ul>
	<li>
		every DAO's contracts, public or private, are stored by the app's validator, which hosts every
		party involved;
	</li>
	<li>
		other validators never receive them, and the synchronizer that orders the transactions sees only
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
<ul>
	<li>
		Choose <Ui>By shares</Ui> when votes should follow ownership, and set the units to match your records.
		Units change only by vote.
	</li>
	<li>
		Choose <Ui>The DAO pays</Ui> to keep costs in one balance that anyone, a treasury wallet included,
		can top up.
	</li>
	<li>Publish the DAO ID where your members can check it.</li>
	<li>
		Read the <a href="/docs/trust-model">Trust Model</a> first: it lists what the app's operator can do,
		and which voting rules limit it.
	</li>
</ul>
