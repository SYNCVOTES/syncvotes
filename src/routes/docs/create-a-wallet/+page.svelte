<script lang="ts">
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	The Wallet page is where you make your key, create your party and sign in. The app walks you
	through five steps: <strong>Phrase</strong>, <strong>Check</strong>, <strong>Party hint</strong>,
	<strong>Keep</strong>, and <strong>Top up</strong> (or <strong>Create</strong> where the network
	charges nothing). Open it with <strong>Sign in</strong> in the header.
</p>

<h2 id="recovery-phrase">Write Down Your Recovery Phrase</h2>
<ol>
	<li>Select <strong>Create key</strong>.</li>
	<li>
		Select <strong>Reveal</strong>. The app shows 12 words, numbered. <strong>Copy</strong> puts
		them on your clipboard; <strong>Hide</strong> covers them again.
	</li>
	<li>Write the words down in order and keep them somewhere safe and offline.</li>
	<li>Select <strong>I have written it down</strong>.</li>
	<li>
		The app asks for one word of the phrase (for example, word 7). Enter it and select
		<strong>Continue</strong>. <strong>Show phrase</strong> takes you back to the words.
	</li>
</ol>
<DocNote tone="warn" title="Keep the phrase">
	<p>
		The phrase is the only way to restore your key. Nobody, including SyncVotes, can recover it for
		you. Anyone who has it can sign as you.
	</p>
</DocNote>

<h2 id="party-hint">Choose a Party Hint</h2>
<p>
	Your <strong>party ID</strong> is a <strong>party hint</strong> you choose, two colons, and the fingerprint
	of your key:
</p>
<p><code>alice::1220ab12cd…</code></p>
<p>
	Others see the hint and recognize you by it. The fingerprint ties the ID to your key. You cannot
	change either later.
</p>
<p>A party hint:</p>
<ul>
	<li>is 2 to 30 characters long;</li>
	<li>uses lowercase letters, digits and dashes;</li>
	<li>
		turns anything else into a dash (<code>Alice Smith</code> becomes <code>alice-smith</code>).
	</li>
</ul>
<p>
	Type the hint and check the party ID the app shows under it. If the app asks for an
	<strong>invite code</strong>, enter it: SyncVotes is by invitation for now, so ask a member for
	one. Then select <strong>Continue</strong>. A wrong code is refused here, before you pay for
	anything.
</p>

<h2 id="keep-the-key">Keep the Key on This Device</h2>
<p>The app offers to store your key on this device, encrypted. Choose one:</p>
<table>
	<thead><tr><th>Option</th><th>What it does</th></tr></thead>
	<tbody>
		<tr>
			<td>Use passkey</td>
			<td>
				Your device's passkey (fingerprint, face or device PIN) unlocks the key. Shown only where
				the browser supports it.
			</td>
		</tr>
		<tr>
			<td>Use password</td>
			<td>A password of at least 8 characters unlocks the key.</td>
		</tr>
		<tr>
			<td>Skip</td>
			<td>
				Nothing is stored. The key lives in this tab only, and closing the tab means restoring from
				the phrase.
			</td>
		</tr>
	</tbody>
</table>
<p>
	The passkey or password only unlocks the copy on this device. Your recovery phrase still works
	everywhere. See <a href="/docs/recovery-phrase-and-devices">Recovery Phrase and Devices</a>.
</p>

<h2 id="create-your-party">Create Your Party</h2>
<p>
	Creating a party is a transaction, and it uses network traffic. What happens next depends on the
	network.
</p>
<h3 id="where-traffic-is-free">Where Traffic Is Free</h3>
<p>
	On a network where SyncVotes charges nothing (TestNet and DevNet today), the app creates your
	party right away. The step reads <strong>Create</strong>, and there is nothing to pay.
</p>
<h3 id="on-mainnet">On MainNet</h3>
<p>
	The step reads <strong>Top up</strong>. The app shows what a party costs today, for example
	<strong>0.00 CC of 1.20 CC for a party</strong>, and how to pay:
</p>
<ol>
	<li>
		Open <strong>Top up</strong>. It shows an <strong>Address</strong> and a <strong>Memo</strong>.
	</li>
	<li>
		From any Canton wallet, send at least the amount shown in Canton Coin (CC) to the Address. Put
		the Memo, exactly as shown, in the transfer's memo or reason field.
	</li>
	<li>
		Wait. The app checks for new transfers every 20 seconds. Once enough has arrived, it shows
		<strong>Received. Creating your party…</strong> and creates it without asking again.
	</li>
</ol>
<p>
	Any extra stays on your balance for later transactions. A transfer without the memo is not
	credited. See <a href="/docs/balances-and-traffic">Balances and Traffic</a>.
</p>
<p>
	If you kept the key on this device, you can close the page while you wait. Unlocking the key later
	brings you back to this step. Where an invite code is needed, the app asks for it again. If you
	skipped, keep the tab open until the party is created. If the tab closes anyway, restore the
	phrase and choose a hint again: what you sent is credited to your key, not to the tab.
</p>

<h2 id="signed-in">Signed In</h2>
<p>Once your party exists, the Wallet page shows:</p>
<ul>
	<li><strong>Signed in as</strong>, with your display name or party hint;</li>
	<li><strong>Party ID</strong>, with a button to copy it;</li>
	<li>your profile (see <a href="/docs/profiles">Profiles</a>);</li>
	<li>your <strong>Balance</strong>, where a network charges for traffic;</li>
	<li><strong>Keys on this device</strong>.</li>
</ul>
<p>
	Share your party ID with a member when you want to join their DAO. They add you with a Members or
	Shares proposal.
</p>

<h2 id="restore-a-key">Restore a Key</h2>
<ol>
	<li>On the Wallet page, select <strong>Restore key</strong>.</li>
	<li>Enter your 12 words, separated by spaces, and select <strong>Restore</strong>.</li>
</ol>
<p>The app looks up the party for your key on this network:</p>
<ul>
	<li>
		<strong>Your party was found.</strong> The app shows your party ID. Choose how to keep the key on
		this device, and you are signed in.
	</li>
	<li>
		<strong>No party on TestNet uses this key</strong> (with this network's name). The phrase is
		valid, but no party on this network was created with it. This is expected when your party is on
		another network: each network has its own parties. Select <strong>Back</strong> to check the phrase
		or switch networks, or choose a party hint to create a new party here.
	</li>
</ul>
<p>
	If the app says <strong>That is not a valid recovery phrase</strong>, a word is misspelled,
	missing or out of order.
</p>

<h2 id="lock-and-unlock">Lock and Unlock</h2>
<p>
	<strong>Lock</strong> removes the key from the page's memory. The encrypted copy stays on the device.
	The app also locks by itself after 15 minutes without a click, tap or key press, and when you close
	the tab or leave the site.
</p>
<p>
	To unlock, open the Wallet page (the header shows <strong>Unlock</strong>) and select
	<strong>Unlock with passkey</strong>, or enter your password and select <strong>Unlock</strong>.
</p>

<h2 id="several-keys">Several Keys on One Device</h2>
<p>
	<strong>Keys on this device</strong> lists every key stored here, each with its own party. From the
	list you can:
</p>
<ul>
	<li><strong>Select</strong> a key to unlock it instead of the current one;</li>
	<li><strong>Create key</strong> or <strong>Restore key</strong> to add another;</li>
	<li><strong>Forget</strong> a key, then confirm with <strong>Yes, forget</strong>.</li>
</ul>
<p>
	Forgetting removes the encrypted copy from this device only. Your party stays on the ledger, and
	your phrase restores it on any device.
</p>
