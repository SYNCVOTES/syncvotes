<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import DocNote from '$lib/components/doc-note.svelte';
	import keepLight from '$lib/assets/docs/wallet-keep-light.webp';
	import keepDark from '$lib/assets/docs/wallet-keep-dark.webp';
	import lockedLight from '$lib/assets/docs/wallet-locked-light.webp';
	import lockedDark from '$lib/assets/docs/wallet-locked-dark.webp';
	import keysLight from '$lib/assets/docs/wallet-keys-light.webp';
	import keysDark from '$lib/assets/docs/wallet-keys-dark.webp';
	import noPartyLight from '$lib/assets/docs/wallet-no-party-light.webp';
	import noPartyDark from '$lib/assets/docs/wallet-no-party-dark.webp';
</script>

<p>
	Your <Ui kind="term">recovery phrase</Ui> is your key. A device only keeps an encrypted copy of it,
	for convenience. This page covers how that copy is kept, locked and removed, and what the phrase does
	on another device or network.
</p>

<h2 id="the-phrase">The Phrase</h2>
<p>
	The phrase is 12 words from the standard BIP-39 English word list. The app turns it into your key
	the same way every time, so the phrase alone brings back the same key, and with it the same party,
	on any device.
</p>
<ul>
	<li>Write it down on paper, in order, and keep it offline.</li>
	<li>Keep it out of chats, notes apps and photos that sync to the cloud.</li>
	<li>Anyone with the phrase can sign as you. Nobody can recover it if you lose it.</li>
</ul>

<h2 id="kept-or-not">A Key Kept on the Device, or Not</h2>
<Shot
	light={keepLight}
	dark={keepDark}
	alt="Keep the key on this device? with a password field, Use password and Skip"
	caption="Keep the key on this device?, asked once for each new or restored key."
/>
<table>
	<thead><tr><th></th><th>Kept</th><th>Not kept (<Ui>Skip</Ui>)</th></tr></thead>
	<tbody>
		<tr>
			<td>Where the key is</td>
			<td>On this device, encrypted; in the page's memory while unlocked</td>
			<td>In this tab's memory only</td>
		</tr>
		<tr
			><td>Next visit</td><td>Unlock with your passkey or password</td><td
				>Restore from the phrase</td
			></tr
		>
		<tr>
			<td>Closing or reloading the tab</td>
			<td>Locks the key; it stays on the device</td>
			<td>The key is gone; restore from the phrase</td>
		</tr>
	</tbody>
</table>

<h2 id="passkey-or-password">Passkey or Password</h2>
<ul>
	<li>
		<Ui>Use passkey</Ui>: your device's passkey (fingerprint, face or device PIN) produces the
		secret that decrypts the key. It needs a browser and device that support passkeys with the PRF
		extension; elsewhere the button is not shown and the password is the only way.
	</li>
	<li>
		<Ui>Use password</Ui>: at least 8 characters. The key is encrypted with a key derived from it,
		so a wrong password fails with <Ui kind="message">Wrong password</Ui>. It cannot be reset;
		restore from the phrase instead.
	</li>
</ul>
<p>
	Either way the phrase stays the real backup. A passkey or password only opens the copy on the
	device where you set it.
</p>

<h2 id="locking">Locking</h2>
<p>The key leaves the page's memory, and you have to unlock again, when:</p>
<ul>
	<li>you select <Ui>Lock</Ui> on the Wallet page;</li>
	<li>15 minutes pass without a click, tap or key press on the page;</li>
	<li>you close or reload the tab, or leave the site.</li>
</ul>
<Shot
	light={lockedLight}
	dark={lockedDark}
	alt="The locked Wallet page: Unlock nina, a password field and Unlock"
	caption="A kept key, locked. A passkey key shows Unlock with passkey instead."
/>
<p>
	Locking also ends your reading session. If the key locks while you are acting, the page says
	<Ui kind="message">Wallet locked. Unlock and try again.</Ui>
</p>

<h2 id="several-keys">Several Keys on One Device</h2>
<p>
	A device can keep several keys, each for its own party, listed under <Ui>Keys on this device</Ui>
	with how each is locked and when it was added. One key is unlocked at a time: <Ui>Select</Ui>
	another to switch, and the current one is locked first. Keeping the same party again replaces its earlier
	entry.
</p>
<Shot
	light={keysLight}
	dark={keysDark}
	alt="Keys on this device, with one key and Forget"
	caption="Keys on this device, with Create key and Restore key to add another."
/>

<h2 id="forgetting">Forgetting a Key</h2>
<p>
	<Ui>Forget</Ui>, then <Ui>Yes, forget</Ui>, removes the key's encrypted copy from this device.
	Nothing else changes: your party stays on the ledger with its DAOs, votes and balance, and the
	phrase restores the key on this or any other device.
</p>
<DocNote tone="warn" title="Before you forget">
	<p>Make sure you have the phrase. Without it, a forgotten key cannot be brought back.</p>
</DocNote>

<h2 id="new-device">Moving to a New Device</h2>
<ol>
	<li>On the new device, open the same SyncVotes site you used before.</li>
	<li>Select <Ui>Restore key</Ui>, enter the phrase and select <Ui>Restore</Ui>.</li>
	<li>The app says <Ui kind="message">Your party was found.</Ui> and asks how to keep the key.</li>
</ol>
<p>Nothing else needs to move: your DAOs and balance are on the ledger, not on the device.</p>

<h2 id="keys-and-networks">Keys and Networks</h2>
<p>
	The phrase gives the same key on every network, but each network has its own parties, and a key
	kept on one site is not kept on another. To use your key on another network, restore the phrase on
	that site. If you have no party there yet, the app says so and offers to create one.
</p>
<Shot
	light={noPartyLight}
	dark={noPartyDark}
	alt="No party on DevNet uses this key"
	caption="A phrase restored on a network where it has no party yet."
/>
<p>See <a href="/docs/networks">Networks</a>.</p>
