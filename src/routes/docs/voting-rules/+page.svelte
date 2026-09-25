<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import DocNote from '$lib/components/doc-note.svelte';
	import rulesLight from '$lib/assets/docs/dao-create-rules-light.webp';
	import rulesDark from '$lib/assets/docs/dao-create-rules-dark.webp';
</script>

<p>
	A <Ui kind="term">rule</Ui> says what it takes for a proposal to pass. Every proposal carries its rule
	from the moment it is made, and the ledger applies it when it counts. All figures are in
	<Ui kind="term">units</Ui> of the vote: one per member in a DAO by membership, the member's holding
	in a DAO by shares.
</p>

<h2 id="two-kinds-of-proposal">Which Rule Applies</h2>
<table>
	<thead><tr><th>Proposal</th><th>Rule</th><th>Set by</th></tr></thead>
	<tbody>
		<tr>
			<td>
				<Ui>Changes to the DAO</Ui>: members and shares, name, description and picture, voting
				rules, visibility, dissolution
			</td>
			<td>The DAO's voting rules</td>
			<td>The creator at creation, then the members by a Voting rules proposal</td>
		</tr>
		<tr>
			<td><Ui>Decisions and choices</Ui></td>
			<td>The proposer's rule</td>
			<td>Whoever makes the proposal</td>
		</tr>
	</tbody>
</table>
<p>
	A decision or a choice changes nothing on the ledger beyond its own record, so its proposer may
	choose how it passes. A change to the DAO always runs under the DAO's voting rules. A proposer
	cannot make one easier to pass.
</p>

<h2 id="the-settings">The Settings</h2>
<table>
	<thead><tr><th>Setting</th><th>Choices</th><th>What it does</th></tr></thead>
	<tbody>
		<tr>
			<td><Ui>Basis</Ui></td>
			<td><Ui>Whole vote</Ui>, <Ui>Votes cast</Ui></td>
			<td>What yes is measured against.</td>
		</tr>
		<tr>
			<td><Ui>Threshold</Ui></td>
			<td><Ui>More than half</Ui>, <Ui>Fraction</Ui>, <Ui>Percentage</Ui></td>
			<td>How much of the basis yes must reach.</td>
		</tr>
		<tr>
			<td><Ui>Quorum</Ui></td>
			<td>0 to 100%</td>
			<td>How much of the whole vote must take part. 0 means no quorum.</td>
		</tr>
		<tr>
			<td><Ui>Settle early</Ui></td>
			<td>On or off</td>
			<td>Decide as soon as the remaining votes cannot change the outcome.</td>
		</tr>
		<tr>
			<td><Ui>Votes may change</Ui></td>
			<td>On or off</td>
			<td>Let members vote again until the deadline. Turns settling early off.</td>
		</tr>
		<tr>
			<td><Ui>Secret ballot</Ui></td>
			<td>On or off</td>
			<td>Show each member only their own vote.</td>
		</tr>
		<tr>
			<td><Ui>Voting period</Ui></td>
			<td>1 to 90 days</td>
			<td>How long the vote is open, from the moment the proposal is signed.</td>
		</tr>
	</tbody>
</table>

<Shot
	light={rulesLight}
	dark={rulesDark}
	alt="The rule settings with Customize ballot and rule open, and the line that works the rule out for this DAO"
	caption="Every setting, with the rule worked out for this DAO underneath."
/>
<p>
	The settings sit under <Ui>Preset</Ui>, behind <Ui>Customize ballot and rule</Ui>, on the Create
	DAO page, on a Voting rules proposal and on every decision or choice. The line underneath works
	the rule out as the form stands, for example
	<code>In this DAO: 4 of 5 members must say yes.</code>
</p>

<h2 id="basis">Basis: Whole Vote or Votes Cast</h2>
<p>
	The <Ui kind="term">whole vote</Ui> is every unit that existed when the proposal was made. Measured
	against it, a member who does not vote, or abstains, counts the same as a no.
</p>
<p>
	<Ui>Votes cast</Ui> counts only yes and no. Members who stay away or abstain do not count either way,
	so a small turnout can decide. Pair this basis with a quorum.
</p>
<p>
	Example: a DAO of 100 units. 30 units take part: 16 yes, 10 no, 4 abstain. The threshold is more
	than half.
</p>
<table>
	<thead><tr><th>Basis</th><th>Yes needs</th><th>Result</th></tr></thead>
	<tbody>
		<tr><td>Whole vote</td><td>more than 50 of 100</td><td>Fails: 16 is not enough</td></tr>
		<tr
			><td>Votes cast</td><td>more than 13 of 26 (yes plus no)</td><td
				>Passes, if the quorum is 30% or less</td
			></tr
		>
	</tbody>
</table>

<h2 id="threshold">Threshold</h2>
<ul>
	<li>
		<Ui>More than half</Ui> means strictly over 50%. Of 100 units, 51 passes and 50 does not. Of 5 members,
		3 pass.
	</li>
	<li>
		<Ui>Fraction</Ui> means at least that fraction, rounded up. Two thirds of 5 members is 4 (3.33 rounded
		up); two thirds of 3 members is 2.
	</li>
	<li>
		<Ui>Percentage</Ui> means at least that percentage, rounded up. 67% of 3 members is 3, since 2 is
		only 66.7%.
	</li>
</ul>
<p>
	Two thirds and 67% differ in small DAOs, as the last example shows. Use a fraction when you mean
	one. A fraction can have a denominator up to 100 and cannot exceed 1.
</p>

<h2 id="quorum">Quorum</h2>
<p>
	The quorum is the share of the whole vote that must take part: yes, no and abstentions all count
	toward it. If it is not met when the proposal is decided, the proposal fails, whatever the yes
	count.
</p>
<p>
	Example: under <Ui>Majority of votes cast</Ui> (quorum 25%) in a DAO of 100 units, 15 units vote yes
	and 5 vote no. That is 75% yes, but only 20% of the vote took part, so the proposal fails. The tally
	says <code>quorum not met: 20% of the vote took part, 25% needed</code>.
</p>

<h2 id="settle-early">Settle Early</h2>
<p>
	With settling early on, the proposal is decided the moment the ballots still to come cannot change
	the outcome. It passes as soon as yes is sure to meet the rule, and fails as soon as yes can no
	longer meet it even if everyone left votes yes.
</p>
<p>Example: a DAO of 5 members under <Ui>Two thirds of the vote</Ui> (4 yes needed).</p>
<ul>
	<li>After 4 yes votes, it passes at once. The fifth vote cannot change that.</li>
	<li>
		After 2 no votes, it fails at once. At most 3 yes votes remain possible, and 4 are needed.
	</li>
</ul>
<p>
	With settling early off, the proposal is decided at the deadline by whatever was cast. Under
	<Ui>Votes cast</Ui>, an early result needs yes to be sure even if every member still to vote says
	no, so most such proposals are decided at the deadline.
</p>

<h2 id="votes-may-change">Votes May Change</h2>
<p>
	With this on, a member can vote again until the deadline, and the new ballot replaces the old one.
	Because any ballot can still change, nothing is counted before the deadline and the proposal
	cannot settle early. The app turns settling early off when you turn this on, and the ledger
	refuses a rule with both.
</p>
<p>With it off, a member's first ballot is final.</p>

<h2 id="secret-ballot">Secret Ballot</h2>
<p>
	The page shows every member the totals, and each member only their own vote. The ballots are still
	on the ledger, and the app sees them because it counts them. See
	<a href="/docs/secret-ballots">Secret Ballots</a>.
</p>

<h2 id="presets">Presets</h2>
<p>
	A preset sets the basis, threshold and quorum at once. Changing any of those by hand switches the
	preset to <Ui>Custom</Ui>.
</p>
<table>
	<thead
		><tr><th>Preset</th><th>Basis</th><th>Threshold</th><th>Quorum</th><th>5 members need</th></tr
		></thead
	>
	<tbody>
		<tr
			><td><Ui>Majority of the vote</Ui></td><td>Whole vote</td><td>More than half</td><td>None</td
			><td>3 yes</td></tr
		>
		<tr
			><td><Ui>Majority of votes cast</Ui></td><td>Votes cast</td><td>More than half</td><td>25%</td
			><td>More yes than no, with at least 2 taking part</td></tr
		>
		<tr
			><td><Ui>Two thirds of the vote</Ui></td><td>Whole vote</td><td>2/3</td><td>None</td><td
				>4 yes</td
			></tr
		>
		<tr><td><Ui>Unanimous</Ui></td><td>Whole vote</td><td>100%</td><td>None</td><td>5 yes</td></tr>
	</tbody>
</table>
<p>The defaults are:</p>
<ul>
	<li>
		<strong>DAO voting rules</strong>: Two thirds of the vote, open ballot, votes final once cast,
		settling early, 14 days.
	</li>
	<li>
		<strong>A decision or choice</strong>: starts from Majority of the vote, open ballot, votes
		final once cast, settling early, 7 days. The proposer can change any of it.
	</li>
</ul>

<h2 id="changing-the-rules">Changing the DAO's Voting Rules</h2>
<p>
	A <Ui>Voting rules</Ui> proposal carries the new ballot and rule. It passes under the rules in force,
	not the ones it proposes. Once executed, the new rules apply to every change to the DAO proposed after
	that. Proposals already open keep the rule they opened with.
</p>
<DocNote title="Choose the basis with care">
	<p>
		Under the whole vote with no quorum, the app cannot make a proposal pass by leaving ballots out
		of the count. Under votes cast, or with a quorum, it could tip a result either way. See
		<a href="/docs/trust-model">Trust Model</a>.
	</p>
</DocNote>
