<script lang="ts">
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import Clause from '$lib/components/clause.svelte';
	import ExternalLink from '$lib/components/external-link.svelte';

	/**
	 * The privacy policy, carried over from SyncVotes v1 and rewritten for how v2 works: every
	 * party is hosted on this app's validator, which co-signs and therefore sees every contract;
	 * the key lives in the browser; one session cookie; the third parties in front of the origin.
	 */
	const GITHUB = 'https://github.com/SYNCVOTES/syncvotes';
	const UPDATED = '25 September 2026';
</script>

<svelte:head>
	<title>Privacy Policy — SyncVotes</title>
	<meta name="description" content="How SyncVotes handles your data on the Canton Network." />
</svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow="Legal"
		title="Privacy Policy"
		description="How SyncVotes handles your data on the Canton Network. Last updated {UPDATED}."
	/>

	<div class="space-y-5">
		<Clause title="Overview">
			<p>
				SyncVotes is an open-source governance platform built on the
				<strong>Canton Network</strong>. It collects the minimum it needs to run: there is no login,
				no e-mail, no tracking and no personal data harvesting. Your key is your identity, and it
				never leaves your browser.
			</p>
		</Clause>

		<Clause title="What this validator sees">
			<p>
				Every party in SyncVotes is hosted on the app's own validator, and the app's party co-signs
				every contract so that the ledger accepts it. This validator therefore sees every DAO run
				here — its name, members, proposals, ballots and comments — as Daml contracts, which it
				needs in order to count ballots and carry out decisions. It cannot act for you: the only key
				that can sign your transactions is yours. In particular, the app sees:
			</p>
			<ul>
				<li>Your party id: the hint you chose and the fingerprint of your key</li>
				<li>
					Your profile, if you keep one — a name, a picture by link, a few words — shown wherever
					your party appears in the app
				</li>
				<li>The contracts of the DAOs you are in, and every ballot and comment in them</li>
				<li>
					Canton Coin transfers to the validator's party (the app's address), read off the ledger to
					credit a balance
				</li>
				<li>The address a request comes from, used to pace sign-ups</li>
			</ul>
			<p>
				Other Canton validators receive none of this: Canton delivers a transaction only to the
				parties in it, and the synchronizer that orders it sees only encrypted views. What keeps a
				DAO to its members on the way to a browser is the app: a DAO is shown only to members who
				have proved they hold their key.
			</p>
		</Clause>

		<Clause title="What we don't collect">
			<ul>
				<li>Personal identity information</li>
				<li>E-mail addresses or passwords — there is no login</li>
				<li>Private keys or recovery phrases — the key is generated and kept in your browser</li>
				<li>Off-chain data or browsing history</li>
				<li>Analytics, advertising identifiers or tracking cookies</li>
			</ul>
		</Clause>

		<Clause title="Your key and your browser">
			<p>
				The key comes from a twelve-word recovery phrase. Between visits it rests in your browser's
				storage encrypted with AES-GCM, unlocked by a passkey or a password, and locks itself after
				fifteen minutes idle. It is never sent to the server: the server prepares each transaction,
				the browser checks and signs the hash, and the server submits the signature. Your theme
				choice is also kept in your browser.
			</p>
		</Clause>

		<Clause title="Sessions and cookies">
			<p>
				SyncVotes sets one cookie, <code>sv_session</code>. Once per unlock the browser signs a
				challenge with your key, and the server keeps a session in memory behind that HttpOnly
				cookie for up to twelve hours, so that a DAO is shown only to its members. A restart of the
				server forgets every session. There are no other cookies.
			</p>
		</Clause>

		<Clause title="On-chain data">
			<p>
				All governance actions — creating a DAO, proposing, voting, commenting — are recorded on the
				Canton Network ledger as Daml contracts. Unlike public blockchains, Canton does
				<strong>not</strong> expose transaction data globally: only the parties on a contract — you, the
				other parties in it and this validator as the host of your party — can see its contents. Comments
				are on the record and cannot be edited or deleted. Ledger retention and visibility are governed
				by the Canton Network protocol, not by SyncVotes.
			</p>
		</Clause>

		<Clause title="Third-party services">
			<p>
				SyncVotes relies on <strong>Canton Network infrastructure</strong> for ledger operations and reads
				Canton Coin prices from the network's public Scan. The site is served through Cloudflare, which
				terminates connections at its edge and sees the requests it forwards, and its fonts are loaded
				from Google Fonts; each handles the requests it serves under its own privacy policy. We do not
				integrate third-party analytics trackers, advertising networks or external data processors.
			</p>
			<p>
				Pictures that users add to DAOs, profiles and descriptions are links: your browser loads
				each one from wherever its author put it. That server sees your address and when the picture
				was loaded, though not the page it was shown on. Anyone who adds a picture can therefore
				learn when it was viewed.
			</p>
		</Clause>

		<Clause title="Data retention">
			<p>
				On-chain data persists on the Canton Network ledger according to the network's own rules.
				The server keeps an in-memory copy of the contracts the app's party sees, rebuilt from the
				ledger on every start; there is no separate database of users. Sessions live in memory for
				at most twelve hours.
			</p>
		</Clause>

		<Clause title="Contact">
			<p>
				SyncVotes is an open-source project. For questions or concerns about this policy, open an
				issue or reach out through the repository.
			</p>
			<p><ExternalLink href={GITHUB} label="github.com/SYNCVOTES/syncvotes" /></p>
		</Clause>
	</div>
</Page>
