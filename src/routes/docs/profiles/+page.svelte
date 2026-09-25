<script lang="ts">
	import Ui from '$lib/components/doc-ui.svelte';
	import Shot from '$lib/components/doc-shot.svelte';
	import profileFormLight from '$lib/assets/docs/profile-form-light.webp';
	import profileFormDark from '$lib/assets/docs/profile-form-dark.webp';
	import profilePageLight from '$lib/assets/docs/profile-page-light.webp';
	import profilePageDark from '$lib/assets/docs/profile-page-dark.webp';
</script>

<p>
	A <Ui kind="term">profile</Ui> gives your party a face: a display name, a picture and a few words. It
	is optional. Without one, others see your party ID, and your party hint stands in for a name.
</p>

<h2 id="what-it-holds">What It Holds</h2>
<table>
	<thead><tr><th>Field</th><th>Limits</th></tr></thead>
	<tbody>
		<tr><td>Display name</td><td>Required, up to 60 characters</td></tr>
		<tr><td>Picture</td><td>Optional, an <code>https</code> link to an image</td></tr>
		<tr><td>About</td><td>Optional, Markdown, up to 2,000 characters</td></tr>
	</tbody>
</table>
<p>
	The display name is only a label. Your party ID does not change, and two parties can use the same
	display name. Check the party ID when it matters who someone is.
</p>

<h2 id="set-it-up">Set It Up</h2>
<ol>
	<li>
		On the Wallet page, select <Ui>Set up profile</Ui> (or <Ui>Edit profile</Ui>).
	</li>
	<li>Fill in the fields.</li>
	<li>
		Select <Ui>Create profile</Ui> (or <Ui>Save profile</Ui>). Your key signs, and the profile is on
		the ledger.
	</li>
</ol>
<p>
	Saving replaces the whole profile with the new one. You can change it at any time, but you cannot
	remove it, only replace it.
</p>

<Shot
	light={profileFormLight}
	dark={profileFormDark}
	alt="The profile form: Display name, Picture and About"
	caption="The profile form on the Wallet page."
/>

<h2 id="who-sees-it">Who Sees It</h2>
<p>
	Anyone signed in to SyncVotes on this network who knows your party ID can see your profile. It
	shows next to your party ID wherever your party appears: members lists, ballots, comments and
	proposals. Select <Ui>View public profile</Ui> on the Wallet page to see it as others do. Each profile
	has its own page, <code>/people/&lt;party ID&gt;</code>.
</p>

<Shot
	light={profilePageLight}
	dark={profilePageDark}
	alt="A public profile page with no profile yet"
	caption="A profile page. Without a profile, others see only the party ID."
/>

<h2 id="who-pays">Who Pays</h2>
<p>
	Creating or changing your profile is charged to your own balance, not to any DAO. Where traffic is
	free, it costs nothing. See <a href="/docs/balances-and-traffic">Balances and Traffic</a>.
</p>
