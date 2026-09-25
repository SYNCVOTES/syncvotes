<script lang="ts">
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import Clause from '$lib/components/clause.svelte';
	import ExternalLink from '$lib/components/external-link.svelte';

	/**
	 * The terms, carried over from SyncVotes v1 and brought in line with what v2 does: a party
	 * made from a key rather than a network identity, balances paid in coin and spent on traffic
	 * rather than prepaid credits, and what is final on the ledger.
	 */
	const GITHUB = 'https://github.com/SYNCVOTES/syncvotes';
	const UPDATED = '23 September 2026';
</script>

<svelte:head>
	<title>Terms of Service — SyncVotes</title>
	<meta
		name="description"
		content="Terms governing the use of SyncVotes — an open-source on-chain governance platform on the Canton Network."
	/>
</svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow="Legal"
		title="Terms of Service"
		description="Terms governing the use of SyncVotes — an open-source on-chain governance platform on the Canton Network. Last updated {UPDATED}."
	/>

	<div class="space-y-5">
		<Clause title="Overview">
			<p>
				These terms govern your use of SyncVotes, an open-source on-chain governance platform built
				on the <strong>Canton Network</strong>. By accessing or using the platform, you agree to be
				bound by these terms.
			</p>
		</Clause>

		<Clause title="Nature of service">
			<p>
				SyncVotes is an interface to Daml smart contracts on the Canton Network and the operator of
				the validator that hosts your party. The platform facilitates DAO creation, proposal
				submission, on-chain voting and the execution of what a DAO decides: it prepares each
				transaction for your key to sign, submits what you signed, counts the ballots and carries
				out the outcome. It does not hold coin or other digital assets for you: Canton Coin sent to
				the app pays for network traffic, as set out under Balances, and is spent rather than kept.
			</p>
		</Clause>

		<Clause title="Eligibility">
			<p>
				Your identity on SyncVotes is a cryptographic key. The app derives it from a twelve-word
				recovery phrase in your browser and creates a Canton party for it, hosted on this app's
				validator, once the party's cost has been paid. There is no account, no password and no way
				for us to recover a lost phrase: whoever holds the phrase holds the party. Access to the
				network is subject to the Canton Network's own participation requirements.
			</p>
		</Clause>

		<Clause title="User responsibilities">
			<p>You are solely responsible for:</p>
			<ul>
				<li>Securing your recovery phrase, your keys and the devices they are unlocked on</li>
				<li>Understanding that governance actions are binding once executed on-chain</li>
				<li>Verifying all proposal details before casting a vote</li>
				<li>Ensuring compliance with applicable laws in your jurisdiction</li>
			</ul>
		</Clause>

		<Clause title="Balances and traffic">
			<p>
				Every transaction consumes Canton Network traffic, which this validator pays for in
				<strong>Canton Coin (CC)</strong>. That cost, net of what the network returns for it, is
				charged to a balance as a prepaid service fee. A DAO founded with the DAO paying pays for
				everything done in it; in a DAO founded with each member paying, a proposal, a vote or a
				comment is charged to the member who signs it, and the counting and execution of a proposal
				to its proposer. A party pays for itself in any case: its creation, its profile and the DAOs
				it founds.
			</p>
			<p>
				A balance is paid in by sending Canton Coin to the validator's party (the address shown in
				the app) from any wallet, with the memo shown on the DAO's page or on the wallet page as the
				transfer's reason. Coin that arrives without a memo the app recognises is not credited;
				write to us through the repository to have it matched.
			</p>
			<p>
				The charge for a transaction is the traffic the validator reports for it at the network's
				traffic price, less the validator's traffic rebate and, where they are earned, the app
				rewards for that traffic, times the factor set by the operator. The price shown in the app
				is this net price. The estimate shown before you sign is not a guarantee of the final
				charge, and prices change with the network's traffic price and rewards. A transaction the
				payer's balance cannot cover is refused before you sign. What is paid in is spent on traffic
				and is not paid back.
			</p>
		</Clause>

		<Clause title="On-chain finality">
			<p>
				A transaction the ledger has accepted is <strong>final</strong>: it cannot be reversed,
				undone or modified through this interface. A ballot can be changed until the deadline only
				where the proposal's ballot allows it. A proposal cannot be edited or withdrawn once made;
				to change course, propose again. Once a proposal settles, its outcome is carried out with
				the DAO's own authority. Exercise due diligence before confirming any governance action.
			</p>
		</Clause>

		<Clause title="No warranty">
			<p>
				This software is provided <strong>"as is"</strong> under the <strong>MIT License</strong>,
				without warranty of any kind. There are no guarantees of uptime, correctness, completeness,
				or fitness for any particular purpose.
			</p>
		</Clause>

		<Clause title="Limitation of liability">
			<p>
				SyncVotes contributors, maintainers, and affiliates are not liable for any losses, damages,
				or adverse outcomes arising from governance decisions, smart contract behavior, Canton
				Network issues, or any use of this platform.
			</p>
		</Clause>

		<Clause title="Open source">
			<p>
				SyncVotes is fully open-source under the MIT License. You are free to inspect, fork, modify,
				and deploy the code independently.
			</p>
			<p><ExternalLink href={GITHUB} label="github.com/SYNCVOTES/syncvotes" /></p>
		</Clause>

		<Clause title="Changes">
			<p>
				We may update these terms as the project evolves. Continued use of SyncVotes after changes
				are published constitutes acceptance of the revised terms.
			</p>
		</Clause>
	</div>
</Page>
