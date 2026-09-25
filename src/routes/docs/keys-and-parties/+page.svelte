<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import DocNote from '$lib/components/doc-note.svelte';
	import homeLight from '$lib/assets/docs/wallet-home-light.webp';
	import homeDark from '$lib/assets/docs/wallet-home-dark.webp';
</script>

<p>
	You act on SyncVotes through two things: a <Ui kind="term">key</Ui> in your browser, which signs, and
	a <Ui kind="term">party</Ui> on the ledger, which acts. This page explains how they fit together, and
	what the app's validator can and cannot do with your party.
</p>

<h2 id="your-key">Your Key</h2>
<p>
	Your key is an ed25519 signing key made from your 12-word recovery phrase. The same phrase always
	gives the same key, on any device.
</p>
<ul>
	<li>
		While you are signed in, the key is in the page's memory, and the page can only ask it to sign.
	</li>
	<li>Between visits it is stored on your device, encrypted, if you chose to keep it.</li>
	<li>It never leaves your browser. The server gets your public key and your signatures.</li>
</ul>
<p>See <a href="/docs/recovery-phrase-and-devices">Recovery Phrase and Devices</a>.</p>

<h2 id="your-party">Your Party</h2>
<p>
	A party is an identity on the Canton ledger: contracts name parties, and transactions act as them.
	Your <Ui kind="term">party ID</Ui> has two parts:
</p>
<table>
	<thead><tr><th>Part</th><th>Example</th><th>What it is</th></tr></thead>
	<tbody>
		<tr
			><td>Party hint</td><td><code>nina</code></td><td
				>The name you chose when you created the party.</td
			></tr
		>
		<tr>
			<td>Fingerprint</td>
			<td><code>12201f26…</code></td>
			<td>A hash of your public key. It ties the party to your key.</td>
		</tr>
	</tbody>
</table>
<Shot
	light={homeLight}
	dark={homeDark}
	alt="The Wallet page showing the full party ID: the hint nina, two colons, and the fingerprint"
	caption="A party ID in full: the hint, two colons, the fingerprint."
/>
<p>
	Because the fingerprint comes from your key, the app finds your party from the key alone. That is
	how restoring a phrase brings your party back.
</p>

<h2 id="hosted-on-the-validator">Hosted on the App's Validator</h2>
<p>
	Your party is an <Ui kind="term">external party</Ui>: its signing key is outside the ledger, with
	you. It is hosted on the SyncVotes <Ui kind="term">validator</Ui>, the Canton node the app runs
	on; hosting is what makes the app's Daml package available to your party.
</p>
<p>
	When your party is created, your browser checks its setup before signing it (the activity box says
	<Ui kind="message">Verifying party</Ui>):
</p>
<ul>
	<li>the party is in your key's own namespace, under the hint you chose;</li>
	<li>your key is its only signing key, and one signature is enough;</li>
	<li>the validator gets <strong>confirmation</strong> rights only.</li>
</ul>
<p>
	Confirmation rights let the validator confirm transactions your party is part of, which Canton
	needs for them to go through. They do not let it submit a transaction as you.
</p>

<h3 id="what-the-validator-can-do">What the Validator Can and Cannot Do</h3>
<table>
	<thead><tr><th>It can</th><th>It cannot</th></tr></thead>
	<tbody>
		<tr>
			<td>See every contract your party is part of, and every ballot in its DAOs</td>
			<td>Sign a transaction as you</td>
		</tr>
		<tr>
			<td>Delay or refuse to process your transactions</td>
			<td>Vote, propose, comment, create a DAO or set a profile in your name</td>
		</tr>
		<tr><td>Stop. While it is down, nothing of yours moves</td><td>Change what you signed</td></tr>
	</tbody>
</table>
<p>The full list is in <a href="/docs/trust-model">Trust Model</a>.</p>

<h2 id="signing-in-the-browser">Why You Sign in the Browser</h2>
<p>
	Every write takes three steps, which the activity box at the bottom right of the page names as
	they run:
</p>
<ol>
	<li>
		<Ui kind="message">Preparing transaction</Ui>: the server builds the transaction and sends it to
		your browser.
	</li>
	<li>
		<Ui kind="message">Verifying transaction</Ui>, then <Ui kind="message">Signing</Ui>: your
		browser checks it, and your key signs its hash.
	</li>
	<li>
		<Ui kind="message">Waiting for confirmation</Ui>: the server submits it with your signature, and
		the ledger checks the signature.
	</li>
</ol>
<p>
	The app's own ledger user has no right to act as your party. A transaction of yours reaches the
	ledger only with your signature.
</p>
<p>
	Reading works the same way. When you unlock, your key signs a one-time challenge and the server
	opens a session for your party, for up to 12 hours. If the server restarts, your browser signs a
	new challenge without asking you. Locking ends the session.
</p>

<h2 id="verify-before-signing">What "Verify Before Signing" Checks</h2>
<p>Before your key signs, the browser decodes the prepared transaction and checks that:</p>
<ul>
	<li>its hash, computed again in the browser, is the hash it was asked to sign;</li>
	<li>it acts as your party and nobody else;</li>
	<li>
		it is one of the five things you can do: create a DAO, set your profile, propose, vote or
		comment;
	</li>
	<li>it uses the Daml package this version of the app was built with;</li>
	<li>it is on the contract the page shows (your membership, for example);</li>
	<li>its arguments are exactly what the page built from your input.</li>
</ul>
<p>If a check fails, nothing is signed and the page shows what did not match.</p>
<DocNote>
	<p>
		A passkey cannot sign a Canton transaction itself. In SyncVotes it only unlocks the stored key,
		which then signs.
	</p>
</DocNote>
