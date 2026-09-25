<script lang="ts">
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	You act on SyncVotes through two things: a <strong>key</strong> in your browser, which signs, and
	a <strong>party</strong> on the ledger, which acts. This page explains how they fit together and what
	the app's validator can and cannot do with your party.
</p>

<h2 id="your-key">Your Key</h2>
<p>
	Your key is an ed25519 signing key made from your 12-word recovery phrase. The same phrase always
	gives the same key, on any device. The key stays in your browser:
</p>
<ul>
	<li>
		While you are signed in, it is in the page's memory, and the page can only ask it to sign.
	</li>
	<li>Between visits, it is stored on your device, encrypted, if you chose to keep it.</li>
	<li>It is never sent to the server.</li>
</ul>
<p>See <a href="/docs/recovery-phrase-and-devices">Recovery Phrase and Devices</a>.</p>

<h2 id="your-party">Your Party</h2>
<p>
	A <strong>party</strong> is an identity on the Canton ledger. Contracts name parties, and a transaction
	acts as a party. Your party ID has two parts:
</p>
<table>
	<thead><tr><th>Part</th><th>Example</th><th>What it is</th></tr></thead>
	<tbody>
		<tr
			><td>Party hint</td><td><code>alice</code></td><td
				>The name you chose when you created the party.</td
			></tr
		>
		<tr
			><td>Fingerprint</td><td><code>1220ab12…</code></td><td
				>A hash of your key's public half. It ties the party to your key.</td
			></tr
		>
	</tbody>
</table>
<p>
	Together they read <code>alice::1220ab12…</code>. Because the fingerprint comes from your key, the
	app can find your party from your key alone. That is how restoring a phrase brings your party
	back.
</p>

<h2 id="hosted-on-the-validator">Hosted on the App's Validator</h2>
<p>
	Your party is an <strong>external party</strong>: its signing key is outside the ledger, with you.
	It is hosted on the SyncVotes <strong>validator</strong>, the Canton node that runs the app. A
	validator has to host your party for the app's Daml package to be available to it.
</p>
<p>When your party is created, your browser checks the setup before signing it:</p>
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
			<td>Vote, propose, comment or create a DAO in your name</td>
		</tr>
		<tr>
			<td>Stop working. While it is down, nothing of yours moves</td>
			<td>Change what you signed</td>
		</tr>
	</tbody>
</table>
<p>The full list is in <a href="/docs/trust-model">Trust Model</a>.</p>

<h2 id="signing-in-the-browser">Why You Sign in the Browser</h2>
<p>Every write goes through three steps:</p>
<ol>
	<li>The server prepares the transaction and sends it to your browser.</li>
	<li>Your browser checks it, then your key signs its hash.</li>
	<li>
		The server submits the transaction with your signature, and the ledger checks the signature.
	</li>
</ol>
<p>
	The app's own ledger user is never allowed to act as your party. The only way a transaction of
	yours reaches the ledger is with your signature.
</p>
<p>
	Reading works the same way. When you unlock, your key signs a one-time challenge, and the server
	opens a session for your party. A session lasts up to 12 hours; if the server restarts, your
	browser signs a new challenge without asking you.
</p>

<h2 id="verify-before-signing">What "Verify Before Signing" Checks</h2>
<p>
	Your browser does not take the server's word for what it is signing. Before your key signs, the
	browser decodes the prepared transaction and checks that:
</p>
<ul>
	<li>its hash, computed again in the browser, is the hash it was asked to sign;</li>
	<li>it acts as your party and nobody else;</li>
	<li>
		it is one of the five things you can do in SyncVotes: create a DAO, set your profile, propose,
		vote or comment;
	</li>
	<li>it uses the Daml package this version of the app was built with;</li>
	<li>it is on the contract the page shows (your membership, for example);</li>
	<li>its arguments are exactly what the page built from your input.</li>
</ul>
<p>
	If any check fails, nothing is signed and the page shows what did not match. The progress label
	reads <strong>Verifying transaction</strong> while these checks run.
</p>
<DocNote>
	<p>
		A passkey cannot sign a Canton transaction itself. In SyncVotes it only unlocks the stored key,
		which then signs.
	</p>
</DocNote>
