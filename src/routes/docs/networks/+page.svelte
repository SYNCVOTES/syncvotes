<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import networkMenuLight from '$lib/assets/docs/network-menu-light.webp';
	import networkMenuDark from '$lib/assets/docs/network-menu-dark.webp';
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	The Canton Network has three public networks, and SyncVotes runs on each as a site of its own. The
	pill next to the SyncVotes logo in the header shows which one you are on.
</p>

<h2 id="the-three-sites">The Three Sites</h2>
<table>
	<thead><tr><th>Network</th><th>Site</th><th>Canton Coin</th><th>Use it for</th></tr></thead>
	<tbody>
		<tr
			><td>MainNet</td><td><a href="https://syncvotes.com" rel="external">syncvotes.com</a></td><td
				>Real CC</td
			><td>Real decisions</td></tr
		>
		<tr
			><td>TestNet</td><td
				><a href="https://test.syncvotes.com" rel="external">test.syncvotes.com</a></td
			><td>Test CC</td><td>Trying SyncVotes out</td></tr
		>
		<tr
			><td>DevNet</td><td
				><a href="https://dev.syncvotes.com" rel="external">dev.syncvotes.com</a></td
			><td>Test CC</td><td>Trying SyncVotes out</td></tr
		>
	</tbody>
</table>
<p>
	The app works the same way on all three. What differs is the ledger underneath, and whether
	traffic is charged: on TestNet and DevNet, SyncVotes currently charges nothing.
</p>

<h2 id="nothing-carries-over">Nothing Carries Over</h2>
<p>Each network is a separate ledger with its own validator for SyncVotes. Between networks:</p>
<ul>
	<li>parties do not carry over: a party on TestNet does not exist on MainNet;</li>
	<li>DAOs, proposals, ballots, comments and profiles do not carry over;</li>
	<li>balances do not carry over, and CC from one network cannot pay on another;</li>
	<li>keys kept on your device are kept per site.</li>
</ul>
<p>
	Your recovery phrase is the one thing that works everywhere. It gives the same key, and so the
	same fingerprint, on every network. To use it on another network, open that site and select
	<Ui>Restore key</Ui>. If you have no party there yet, the app says so and lets you create one.
</p>
<DocNote>
	<p>
		Your party ID on another network has the same fingerprint, but you choose its party hint again
		when you create it there.
	</p>
</DocNote>

<h2 id="switching">Switching Networks</h2>
<Shot
	light={networkMenuLight}
	dark={networkMenuDark}
	alt="The network menu open under the DevNet pill, listing MainNet and TestNet"
	caption="The network pill, opened."
/>

<p>
	Select the network pill in the header to open the list of the other networks, then select one. The
	switch opens the other site on the same list page (My DAOs, Public DAOs, the Wallet page or these
	docs), or on My DAOs. It never opens a DAO, since that DAO does not exist on the other network.
</p>
