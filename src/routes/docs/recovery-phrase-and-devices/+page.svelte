<script lang="ts">
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	Your recovery phrase is your key. A device only keeps an encrypted copy of it, for convenience.
	This page covers how that copy is kept, locked and removed, and what the phrase does on another
	device or network.
</p>

<h2 id="the-phrase">The Phrase</h2>
<p>
	The phrase is 12 words from the standard BIP-39 English word list. The app turns it into your key
	the same way every time, so the phrase alone brings back the same key, and with it the same party,
	on any device.
</p>
<ul>
	<li>Write it down on paper, in order, and keep it offline.</li>
	<li>Do not store it in the browser, a chat or a photo that syncs to the cloud.</li>
	<li>Anyone with the phrase can sign as you. Nobody can recover it if you lose it.</li>
</ul>

<h2 id="kept-or-not">A Key Kept on the Device, or Not</h2>
<table>
	<thead><tr><th></th><th>Kept</th><th>Not kept (Skip)</th></tr></thead>
	<tbody>
		<tr>
			<td>Where the key is</td>
			<td>On this device, encrypted, and in the page's memory while unlocked</td>
			<td>In this tab's memory only</td>
		</tr>
		<tr>
			<td>Next visit</td>
			<td>Unlock with your passkey or password</td>
			<td>Restore from the phrase</td>
		</tr>
		<tr>
			<td>Closing the tab</td>
			<td>Locks the key; it stays on the device</td>
			<td>Gone; restore from the phrase</td>
		</tr>
	</tbody>
</table>

<h2 id="passkey-or-password">Passkey or Password</h2>
<p>A kept key is encrypted with one of these:</p>
<ul>
	<li>
		<strong>Passkey</strong>: your device's passkey (fingerprint, face or device PIN) produces the
		secret that decrypts the key. It needs a browser and device that support passkeys with the PRF
		extension. Where they do not, the app offers the password only.
	</li>
	<li>
		<strong>Password</strong>: at least 8 characters. The app derives the encryption key from it, so
		a wrong password simply fails to decrypt. There is no way to reset it; restore from the phrase
		instead.
	</li>
</ul>
<p>
	Either way, the phrase stays the real backup. A passkey or password only opens the copy on the
	device where you set it.
</p>

<h2 id="locking">Locking</h2>
<p>The key leaves the page's memory, and you have to unlock again, when:</p>
<ul>
	<li>you select <strong>Lock</strong> on the Wallet page;</li>
	<li>15 minutes pass without a click, tap or key press on the page;</li>
	<li>you close the tab or leave the site.</li>
</ul>
<p>
	Locking also ends your reading session. The encrypted copy stays on the device. If the app locks
	while you are acting, it says <strong>Wallet locked. Unlock and try again.</strong>
</p>

<h2 id="several-keys">Several Keys on One Device</h2>
<p>
	One device can keep several keys, each for its own party. The Wallet page lists them under
	<strong>Keys on this device</strong>, with how each is locked and when it was added. One key is
	unlocked at a time: <strong>Select</strong> another to switch, and the current one locks first. Keeping
	the same party again replaces its earlier entry.
</p>

<h2 id="forgetting">Forgetting a Key</h2>
<p>
	<strong>Forget</strong>, then <strong>Yes, forget</strong>, removes the key's encrypted copy from
	this device. Nothing else changes:
</p>
<ul>
	<li>your party stays on the ledger, with its DAOs, votes and balance;</li>
	<li>the phrase restores the key on this or any other device.</li>
</ul>
<DocNote tone="warn" title="Before you forget">
	<p>Make sure you have the phrase. Without it, a forgotten key cannot be brought back.</p>
</DocNote>

<h2 id="new-device">Moving to a New Device</h2>
<ol>
	<li>On the new device, open the same SyncVotes site you used before.</li>
	<li>Select <strong>Restore key</strong> and enter the phrase.</li>
	<li>The app finds your party and asks how to keep the key on this device.</li>
</ol>
<p>Nothing needs to be moved: your DAOs and balance are on the ledger, not on the device.</p>

<h2 id="keys-and-networks">Keys and Networks</h2>
<p>
	Your phrase gives the same key on every network, but each network has its own parties. A key kept
	on the TestNet site is not on the MainNet site. To use your key on another network, restore the
	phrase there. If you have no party on that network yet, the app says so and offers to create one.
	See <a href="/docs/networks">Networks</a>.
</p>
