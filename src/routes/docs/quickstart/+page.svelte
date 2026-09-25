<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import DocNote from '$lib/components/doc-note.svelte';
	import welcomeLight from '$lib/assets/docs/wallet-welcome-light.webp';
	import welcomeDark from '$lib/assets/docs/wallet-welcome-dark.webp';
	import hintLight from '$lib/assets/docs/wallet-hint-light.webp';
	import hintDark from '$lib/assets/docs/wallet-hint-dark.webp';
	import summaryLight from '$lib/assets/docs/dao-create-summary-light.webp';
	import summaryDark from '$lib/assets/docs/dao-create-summary-dark.webp';
	import voteLight from '$lib/assets/docs/proposal-vote-light.webp';
	import voteDark from '$lib/assets/docs/proposal-vote-dark.webp';
</script>

<p>
	This page takes you from nothing to a decided proposal on TestNet in about five minutes. You need
	a browser, somewhere to write down 12 words, and an invite code from a member: sign-up is by
	invitation for now.
</p>
<DocNote>
	<p>
		TestNet is for trying SyncVotes out. Nothing you create there carries over to MainNet. See
		<a href="/docs/networks">Networks</a>.
	</p>
</DocNote>

<h2 id="create-a-key">Create a Key</h2>
<ol>
	<li>Open <a href="https://test.syncvotes.com" rel="external">test.syncvotes.com</a>.</li>
	<li>Select <Ui>Sign in</Ui> in the header. The Wallet page opens.</li>
	<li>Select <Ui>Create key</Ui>.</li>
	<li>
		Select <Ui>Reveal</Ui>, write down the 12 words in order, then select
		<Ui>I have written it down</Ui>.
	</li>
	<li>Enter the word the app asks for (for example, word 7) and select <Ui>Continue</Ui>.</li>
</ol>
<Shot
	light={welcomeLight}
	dark={welcomeDark}
	alt="The Wallet page with no key on the device: Create key and Restore key"
	caption="The Wallet page on a device with no key."
/>

<h2 id="create-your-party">Create Your Party</h2>
<ol>
	<li>
		Type a party hint, such as <code>alice</code>. Under it the app shows the party ID you will get,
		<code>alice::1220…</code>.
	</li>
	<li>Enter your invite code in <Ui>Invite code</Ui>, and select <Ui>Continue</Ui>.</li>
	<li>
		Under <Ui kind="message">Keep the key on this device?</Ui>, type a password of at least 8
		characters and select <Ui>Use password</Ui>, or select <Ui>Use passkey</Ui> where it is offered.
	</li>
</ol>
<Shot
	light={hintLight}
	dark={hintDark}
	alt="Choose a party hint: the hint field with the party ID it gives, and the invite code field"
	caption="The party hint and the party ID it gives."
/>
<p>
	TestNet charges nothing, so the app creates your party straight away. When it is done, the Wallet
	page shows <Ui>Signed in as</Ui> and your party ID, and the header shows your hint.
</p>

<h2 id="create-a-dao">Create a DAO</h2>
<ol>
	<li>Select <Ui>My DAOs</Ui> in the header, then <Ui>Create DAO</Ui>.</li>
	<li>Under <Ui>Basics</Ui>, enter a name, such as <code>Book Club</code>.</li>
	<li>
		Leave the rest as it is: <Ui>By membership</Ui>, <Ui>Private</Ui>, <Ui>The DAO pays</Ui>, and
		the <Ui>Two thirds of the vote</Ui> preset.
	</li>
	<li>
		Under <Ui>Members</Ui> you are already listed. To add others, type or paste their party IDs into
		<Ui>Add party IDs</Ui>. They must have created their party on TestNet first.
	</li>
	<li>Select <Ui>Create DAO</Ui>. Your key signs, and the DAO page opens.</li>
</ol>
<Shot
	light={summaryLight}
	dark={summaryDark}
	alt="The summary beside the Create DAO form, with the Create DAO button"
	caption="The summary of what you are about to sign, next to the form."
/>

<h2 id="make-a-decision">Make a Decision</h2>
<ol>
	<li>On the DAO page, select <Ui>New proposal</Ui>.</li>
	<li>Leave the type on <Ui>Decision</Ui>.</li>
	<li>Enter a title, such as <code>Read Middlemarch next</code>, and a description if you like.</li>
	<li>
		Under <Ui>Voting</Ui>, leave the preset on <Ui>Majority of the vote</Ui>. The vote is open for 7
		days.
	</li>
	<li>Select <Ui>Create proposal</Ui>. The proposal page opens, and the vote is open.</li>
</ol>

<h2 id="vote">Vote</h2>
<ol>
	<li>Under <Ui>Your vote</Ui>, select <Ui>Yes</Ui>.</li>
	<li>
		Watch the <Ui>Tally</Ui>. If you are the only member, your yes is the whole vote, and the
		proposal shows <Ui>Passed</Ui> as soon as the app counts your ballot, usually within seconds.
	</li>
</ol>
<Shot
	light={voteLight}
	dark={voteDark}
	alt="The Your vote box with Yes, No and Abstain, above the tally"
	caption="Your vote, with your voting power, above the tally."
/>
<p>
	In a DAO of 5 members the same rule needs 3 yes votes. The proposal passes as soon as the third
	yes is counted, because the other 2 can no longer change the outcome.
</p>

<h2 id="next-steps">Next Steps</h2>
<ul>
	<li>
		<a href="/docs/create-a-wallet">Create a Wallet</a>: every wallet screen, and restoring a key.
	</li>
	<li>
		<a href="/docs/create-a-dao">Create a DAO</a>: voting by shares, public DAOs and who pays.
	</li>
	<li><a href="/docs/voting-rules">Voting Rules</a>: what each setting does, with examples.</li>
</ul>
