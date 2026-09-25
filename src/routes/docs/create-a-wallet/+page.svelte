<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import DocNote from '$lib/components/doc-note.svelte';
	import welcomeLight from '$lib/assets/docs/wallet-welcome-light.webp';
	import welcomeDark from '$lib/assets/docs/wallet-welcome-dark.webp';
	import phraseLight from '$lib/assets/docs/wallet-phrase-light.webp';
	import phraseDark from '$lib/assets/docs/wallet-phrase-dark.webp';
	import checkLight from '$lib/assets/docs/wallet-check-light.webp';
	import checkDark from '$lib/assets/docs/wallet-check-dark.webp';
	import hintLight from '$lib/assets/docs/wallet-hint-light.webp';
	import hintDark from '$lib/assets/docs/wallet-hint-dark.webp';
	import keepLight from '$lib/assets/docs/wallet-keep-light.webp';
	import keepDark from '$lib/assets/docs/wallet-keep-dark.webp';
	import homeLight from '$lib/assets/docs/wallet-home-light.webp';
	import homeDark from '$lib/assets/docs/wallet-home-dark.webp';
	import noPartyLight from '$lib/assets/docs/wallet-no-party-light.webp';
	import noPartyDark from '$lib/assets/docs/wallet-no-party-dark.webp';
	import lockedLight from '$lib/assets/docs/wallet-locked-light.webp';
	import lockedDark from '$lib/assets/docs/wallet-locked-dark.webp';
	import keysLight from '$lib/assets/docs/wallet-keys-light.webp';
	import keysDark from '$lib/assets/docs/wallet-keys-dark.webp';
</script>

<p>
	The Wallet page is where you make your key, create your party and sign in. Open it with
	<Ui>Sign in</Ui> in the header (<Ui>Unlock</Ui> when a key on the device is locked). Making a key takes
	five steps, numbered along the top: <Ui>Phrase</Ui>, <Ui>Check</Ui>, <Ui>Party hint</Ui>,
	<Ui>Keep</Ui> and <Ui>Top up</Ui>, which reads <Ui>Create</Ui> on a network that charges nothing.
</p>
<Shot
	light={welcomeLight}
	dark={welcomeDark}
	alt="No key on this device: Create key and Restore key, and what creating a party costs"
	caption="With no key on the device. The line underneath says what a party costs on this network."
/>

<h2 id="recovery-phrase">Write Down Your Recovery Phrase</h2>
<ol>
	<li>Select <Ui>Create key</Ui>.</li>
	<li>
		Select <Ui>Reveal</Ui>. The app shows 12 numbered words. <Ui>Copy</Ui> puts them on your clipboard
		and <Ui>Hide</Ui> covers them again.
	</li>
	<li>Write the words down in order and keep them somewhere safe and offline.</li>
	<li>Select <Ui>I have written it down</Ui>. It works once the words have been revealed.</li>
</ol>
<Shot
	light={phraseLight}
	dark={phraseDark}
	alt="Your recovery phrase: twelve numbered words with Hide and Copy"
	caption="The recovery phrase, revealed. This one belongs to a DevNet test key."
/>
<p>
	Next, <Ui kind="message">Confirm phrase</Ui> asks for one word of it, for example word 7. Type it and
	select <Ui>Continue</Ui>. A wrong word shows <Ui kind="message">That is not word 7.</Ui>, and
	<Ui>Show phrase</Ui> takes you back to the words.
</p>
<Shot
	light={checkLight}
	dark={checkDark}
	alt="Confirm phrase: one word asked back"
	caption="One word of the phrase, asked back."
/>
<DocNote tone="warn" title="Keep the phrase">
	<p>
		The phrase is the only way to restore your key. Nobody, including SyncVotes, can recover it, and
		anyone who has it can sign as you.
	</p>
</DocNote>

<h2 id="party-hint">Choose a Party Hint</h2>
<p>
	Your <Ui kind="term">party ID</Ui> is the <Ui kind="term">party hint</Ui> you choose, two colons, and
	the fingerprint of your key: <code>sam::1220dd2a…</code>. Others recognize you by the hint; the
	fingerprint ties the ID to your key. Neither can be changed later.
</p>
<ul>
	<li>A hint is 2 to 30 characters: lowercase letters, digits and dashes.</li>
	<li>
		Anything else becomes a dash, and capitals become lowercase: <code>Sam Lee</code> gives
		<code>sam-lee</code>.
	</li>
	<li>The line under the field shows the party ID you will get, before you commit to it.</li>
</ul>
<p>
	While sign-up is by invitation, the screen also has <Ui>Invite code</Ui>; ask a member for one.
	Select <Ui>Continue</Ui>. A wrong code is refused here, with <Ui kind="message"
		>Invalid invite code.</Ui
	>, before anything is paid.
</p>
<Shot
	light={hintLight}
	dark={hintDark}
	alt="Choose a party hint, with the party ID it gives underneath"
	caption="The hint, and the party ID it gives."
/>

<h2 id="keep-the-key">Keep the Key on This Device</h2>
<p><Ui kind="message">Keep the key on this device?</Ui> offers three choices:</p>
<table>
	<thead><tr><th>Choice</th><th>What happens</th></tr></thead>
	<tbody>
		<tr>
			<td><Ui>Use passkey</Ui></td>
			<td>
				Your device's passkey unlocks the key from now on. Shown only where the browser supports
				passkeys that can guard a key (the PRF extension).
			</td>
		</tr>
		<tr>
			<td><Ui>Use password</Ui></td>
			<td>A password of at least 8 characters unlocks the key.</td>
		</tr>
		<tr>
			<td><Ui>Skip</Ui></td>
			<td
				>Nothing is stored. The key lives in this tab only; closing it means restoring the phrase.</td
			>
		</tr>
	</tbody>
</table>
<Shot
	light={keepLight}
	dark={keepDark}
	alt="Keep the key on this device? with a password field, Use password and Skip"
	caption="Keeping the key on this device. Use passkey appears above the password where the browser supports it."
/>

<h2 id="create-your-party">Create Your Party</h2>
<p>
	Creating a party is a transaction and uses network traffic. What happens next depends on the
	network.
</p>
<h3 id="where-traffic-is-free">Where Traffic Is Free</h3>
<p>
	On DevNet and TestNet today, the step reads <Ui>Create</Ui> and the screen <Ui kind="message"
		>Creating your party</Ui
	>. The app creates the party right away and signs you in.
</p>
<h3 id="where-traffic-is-charged">Where Traffic Is Charged</h3>
<p>
	On MainNet, the step reads <Ui>Top up</Ui> and the screen <Ui kind="message"
		>Pay for your party</Ui
	>.
</p>
<ol>
	<li>
		The balance shows how much has arrived of what a party costs today, for example
		<code>0.00 CC of 1.20 CC for a party</code>.
	</li>
	<li>
		Open <Ui>Top up</Ui>. It shows an <Ui>Address</Ui> and a <Ui>Memo</Ui>, each with a copy button.
	</li>
	<li>
		From any Canton wallet, send at least the amount shown to the Address, with the Memo exactly as
		shown in the transfer's memo (reason) field.
	</li>
	<li>
		Wait. The app checks for new transfers every 20 seconds. Once enough has arrived it shows
		<Ui kind="message">Received. Creating your party…</Ui> and creates the party without asking again.
	</li>
</ol>
<p>
	Anything above the cost stays on your balance. A transfer without the memo is not credited. See
	<a href="/docs/balances-and-traffic">Balances and Traffic</a>.
</p>
<p>
	If you kept the key, you can close the page while you wait: unlocking the key later brings you
	back to this screen, where the app asks for the invite code again. If you skipped, the page says
	<Ui kind="message">Keep this tab open until the party is created.</Ui> If the tab closes anyway, restore
	the phrase and choose a hint again: what you sent is credited to the key, not to the tab.
</p>

<h2 id="signed-in">Signed In</h2>
<p>With your party created, the Wallet page shows, from the top:</p>
<ul>
	<li>
		<Ui>Signed in as</Ui> with your display name or hint, <Ui>unlocked</Ui> and <Ui>Lock</Ui>;
	</li>
	<li><Ui>Party ID</Ui> in full, with a copy button;</li>
	<li><Ui>Set up profile</Ui> (or <Ui>Edit profile</Ui>) and <Ui>View public profile</Ui>;</li>
	<li>
		<Ui>Balance</Ui>, or on a free network <Ui kind="message"
			>Transactions are free on this network for now.</Ui
		>;
	</li>
	<li><Ui>Keys on this device</Ui>.</li>
</ul>
<Shot
	light={homeLight}
	dark={homeDark}
	alt="Signed in as nina, with the full party ID and a copy button"
	caption="Signed in. Copy the party ID to share it with a DAO's members."
/>
<p>
	To join a DAO, send your party ID to one of its members; they add you with a Members or Shares
	proposal.
</p>

<h2 id="restore-a-key">Restore a Key</h2>
<ol>
	<li>On the Wallet page, select <Ui>Restore key</Ui>.</li>
	<li>Enter the 12 words, separated by spaces, and select <Ui>Restore</Ui>.</li>
</ol>
<p>The app looks for your key's party on this network:</p>
<ul>
	<li>
		<Ui kind="message">Your party was found.</Ui> The screen shows your party ID above
		<Ui kind="message">Keep the key on this device?</Ui>. Choose, and you are signed in.
	</li>
	<li>
		<Ui kind="message">No party on DevNet uses this key.</Ui> (with this network's name). The phrase is
		valid, but no party was created with it on this network, typically because your party is on another
		network. Select <Ui>Back</Ui> to check the phrase or switch networks, or choose a hint to create a
		new party here.
	</li>
</ul>
<Shot
	light={noPartyLight}
	dark={noPartyDark}
	alt="No party on DevNet uses this key, above the party hint form"
	caption="A valid phrase with no party on this network."
/>
<p>
	<Ui kind="message">That is not a valid recovery phrase</Ui> means a word is misspelled or missing, or
	the words are out of order.
</p>

<h2 id="lock-and-unlock">Lock and Unlock</h2>
<p>
	<Ui>Lock</Ui> removes the key from the page's memory; the encrypted copy stays on the device. The app
	also locks by itself after 15 minutes without a click, tap or key press, and when you close the tab,
	reload it or leave the site.
</p>
<p>
	To unlock, open the Wallet page and select <Ui>Unlock with passkey</Ui>, or enter the password and
	select <Ui>Unlock</Ui>. Pages that need your key show the same form in place.
</p>
<Shot
	light={lockedLight}
	dark={lockedDark}
	alt="Unlock nina: a password field and Unlock"
	caption="A key kept with a password, locked."
/>

<h2 id="several-keys">Several Keys on One Device</h2>
<p>
	<Ui>Keys on this device</Ui> lists every key kept here, each its own party, with how it is locked and
	when it was added. From the list:
</p>
<ul>
	<li><Ui>Select</Ui> offers another key to unlock; the current one is locked first.</li>
	<li><Ui>Create key</Ui> and <Ui>Restore key</Ui> add another.</li>
	<li><Ui>Forget</Ui>, then <Ui>Yes, forget</Ui>, removes a key from this device.</li>
</ul>
<Shot
	light={keysLight}
	dark={keysDark}
	alt="Keys on this device: one key, kept with a password, unlocked, with Forget"
	caption="Keys on this device."
/>
<p>
	Forgetting removes the encrypted copy from this device only. Your party stays on the ledger, and
	the phrase restores it anywhere.
</p>
