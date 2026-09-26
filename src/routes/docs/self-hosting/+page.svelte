<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import DocNote from '$lib/components/doc-note.svelte';
</script>

<p>
	On syncvotes.com, every party and every DAO is hosted on our validator, and the app co-signs every
	contract. So our validator holds every DAO, private ones included, and every ballot, secret ones
	included. You do not have to use our site: SyncVotes is open source, and you can run it on a
	validator of your own. Then your validator holds your DAOs, and ours never sees them.
</p>

<h2 id="hosted-or-your-own">Hosted by Us or Your Own</h2>
<table>
	<thead><tr><th></th><th>syncvotes.com</th><th>Your own validator</th></tr></thead>
	<tbody>
		<tr
			><td>Who can read private DAOs and secret ballots</td><td>Our validator’s operator</td><td
				>Your validator’s operator, that is you</td
			></tr
		>
		<tr
			><td>Traffic cost</td><td
				>Lower: SyncVotes is a featured app, and its app rewards pay back part of the traffic</td
			><td>The full network price, unless your deployment earns app rewards of its own</td></tr
		>
		<tr
			><td>Upkeep</td><td>None</td><td
				>A validator, a server, updates and backups are yours to run</td
			></tr
		>
		<tr
			><td>Keys, parties and DAOs</td><td>Made here</td><td
				>Made on your site; nothing moves over from ours</td
			></tr
		>
	</tbody>
</table>
<p>
	Most communities are fine with our site: members still cannot read a private DAO they are not in,
	and a secret ballot stays hidden from other members. Self-host when it matters that no outside
	operator can read your DAOs at all.
</p>

<h2 id="what-you-need">What You Need</h2>
<ul>
	<li>
		A Splice validator on the network you want (MainNet, TestNet or DevNet), onboarded and able to
		buy traffic. See the validator guides on
		<a href="https://docs.canton.network" rel="external">docs.canton.network</a>.
	</li>
	<li>A Linux server for that validator with Docker, and a domain for the site.</li>
	<li>
		The code: <a href="https://github.com/SYNCVOTES/syncvotes" rel="external"
			>github.com/SYNCVOTES/syncvotes</a
		>.
	</li>
</ul>

<h2 id="set-it-up">Set It Up</h2>
<ol>
	<li>
		<strong>Settings.</strong> Copy <code>.env.example</code> to <code>&lt;network&gt;.env</code>
		and fill it in: your domain (<code>APP_DOMAIN</code>), the server’s address, the network’s Scan
		(<code>SCAN_URL</code>), your validator’s party hint (<code>WALLET_USER_NAME</code>), and long
		random values for every secret. Set <code>NETWORKS</code> to your own site only.
	</li>
	<li>
		<strong>Sign-in for the ledger.</strong> The app, its backend and your validator trust one
		Keycloak realm, which the app’s compose file brings. Start Keycloak and Caddy first (<code
			>docker compose --env-file &lt;network&gt;.env up -d keycloak caddy</code
		>), then point your validator’s <code>.env</code> at the realm,
		<code>https://&lt;your domain&gt;/auth/realms/canton</code>
		(<code>AUTH_URL</code>, <code>AUTH_JWKS_URL</code>, <code>AUTH_WELLKNOWN_URL</code>, the
		audiences and client ids), and restart the validator.
	</li>
	<li>
		<strong>The app’s party and ledger user.</strong> Run
		<code>scripts/setup-participant.mjs</code> as its header describes. It makes the app’s own
		party, <code>syncvotes-app-provider</code>, and the app’s ledger user with the rights it needs,
		and prints the party id. Put it in <code>PROVIDER_PARTY</code>, and your validator’s own party
		in
		<code>PAYEE_PARTY</code>.
	</li>
	<li>
		<strong>Start the app.</strong>
		<code>docker compose --env-file &lt;network&gt;.env build</code>, then <code>up -d</code>. The
		app uploads its Daml package at startup; <code>https://&lt;your domain&gt;/version</code> then names
		the package it runs.
	</li>
	<li>
		<strong>Who pays.</strong> For a community of your own, <code>BILLING_FACTOR=0</code> lets your
		validator pay all traffic, so members never top up. Keep <code>INVITE_CODES</code> set so only your
		people can sign up.
	</li>
</ol>
<p>
	The details of every setting, the proxy options and how updates work are in the repository’s
	README, under Run Your Own.
</p>

<h2 id="after">After It Runs</h2>
<ul>
	<li>
		Members create new keys and parties on your site. A party made on syncvotes.com stays hosted on
		our validator; use a fresh key for yours.
	</li>
	<li>DAOs do not move between sites. Create the DAO again on yours and add the members there.</li>
	<li>
		Keep the package name <code>syncvotes</code> and take our releases as they come: each is an upgrade
		of the last, so your contracts carry over.
	</li>
</ul>
<DocNote title="Rewards on your own site">
	<p>
		Your deployment can earn app rewards too: apply for featured status for your own app party, and
		your members’ traffic costs less.
	</p>
</DocNote>
<p>
	What the app can and cannot do on any site is in <a href="/docs/trust-model">Trust Model</a>; the
	<Ui kind="term">validator</Ui> and <Ui kind="term">party</Ui> are in the
	<a href="/docs/glossary">Glossary</a>.
</p>
