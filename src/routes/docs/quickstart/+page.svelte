<script lang="ts">
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	This page takes you from nothing to a decided proposal on TestNet in about five minutes. You need
	a browser, somewhere to write down 12 words and, while sign-up is by invitation, an invite code
	from a member.
</p>
<DocNote>
	<p>
		TestNet is for trying SyncVotes out. What you create there stays on TestNet: it does not carry
		over to MainNet. See <a href="/docs/networks">Networks</a>.
	</p>
</DocNote>

<h2 id="create-a-key">Create a Key</h2>
<ol>
	<li>Open <a href="https://test.syncvotes.com" rel="external">test.syncvotes.com</a>.</li>
	<li>Select <strong>Sign in</strong> in the header. The Wallet page opens.</li>
	<li>Select <strong>Create key</strong>.</li>
	<li>
		Select <strong>Reveal</strong> and write down the 12 words in order. Then select
		<strong>I have written it down</strong>.
	</li>
	<li>
		Enter the word the app asks for (for example, word 7) and select <strong>Continue</strong>.
	</li>
</ol>

<h2 id="create-your-party">Create Your Party</h2>
<ol>
	<li>
		Type a party hint, such as <code>alice</code>. The app shows the party ID you will get, for
		example <code>alice::1220ab12…</code>.
	</li>
	<li>If the app asks for an invite code, enter it.</li>
	<li>Select <strong>Continue</strong>.</li>
	<li>
		Keep the key on this device: select <strong>Use passkey</strong>, or type a password of at least
		8 characters and select <strong>Use password</strong>.
	</li>
</ol>
<p>
	The app creates your party. This is free on TestNet, so there is nothing to top up. When it is
	done, the Wallet page shows <strong>Signed in as</strong> with your party ID.
</p>

<h2 id="create-a-dao">Create a DAO</h2>
<ol>
	<li>Select <strong>My DAOs</strong> in the header, then <strong>Create DAO</strong>.</li>
	<li>Under <strong>Basics</strong>, enter a name, such as <code>Book Club</code>.</li>
	<li>
		Leave the other choices as they are: <strong>By membership</strong>, <strong>Private</strong>
		and <strong>The DAO pays</strong>.
	</li>
	<li>
		Under <strong>Members</strong>, you are already listed. To add others, paste their party IDs.
		They must have created their party on TestNet first.
	</li>
	<li>Select <strong>Create DAO</strong>. Your key signs, and the DAO page opens.</li>
</ol>

<h2 id="make-a-decision">Make a Decision</h2>
<ol>
	<li>On the DAO page, select <strong>New proposal</strong>.</li>
	<li>Leave the type on <strong>Decision</strong>.</li>
	<li>Enter a title, such as <code>Read Middlemarch next</code>, and a description if you like.</li>
	<li>
		Under <strong>Voting</strong>, leave the preset on <strong>Majority of the vote</strong>. The
		vote stays open for 7 days.
	</li>
	<li>Select <strong>Create proposal</strong>. The proposal page opens, and the vote is open.</li>
</ol>

<h2 id="vote">Vote</h2>
<ol>
	<li>Under <strong>Your vote</strong>, select <strong>Yes</strong>.</li>
	<li>
		Watch the <strong>Tally</strong>. If you are the only member, your yes is the whole vote, so the
		proposal passes as soon as the app counts your ballot.
	</li>
</ol>
<p>
	In a DAO of 5 members, the same rule needs 3 yes votes. The proposal passes the moment the third
	yes is counted, because the other 2 votes can no longer change the outcome.
</p>

<h2 id="next-steps">Next Steps</h2>
<ul>
	<li>
		<a href="/docs/create-a-wallet">Create a Wallet</a>: every screen of the wallet, including
		restoring a key.
	</li>
	<li>
		<a href="/docs/create-a-dao">Create a DAO</a>: voting by shares, public DAOs and who pays.
	</li>
	<li><a href="/docs/voting-rules">Voting Rules</a>: what each setting does, with examples.</li>
</ul>
