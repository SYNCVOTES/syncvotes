# syncvotes

On-chain governance for the Canton Network: private DAOs, proposals and votes, signed by a key
only the member holds. MVP v2, running against its own validator on TestNet at
<https://dev.syncvotes.com>.

A DAO here is private to its members and run by nobody: everything it changes about itself —
who is in it and with what share of the vote, what it is called, whether it goes on — it
decides by vote, each member weighing their share, under the DAO's own settings, and the
ledger carries the decision out. The party that created it is just that, the creator. Nobody
withdraws a proposal once it is made. A DAO votes by membership (one member, one vote) or by
shares (units of the vote, like shares of a company). It holds no coin: everything it does
costs network traffic, paid from a balance anyone tops up by sending Canton Coin to the app
with the DAO's memo. Proposals and descriptions are Markdown, with pictures by link; every
proposal has a comment thread; a member may keep a profile.

## Architecture

Every user is an [external party](https://docs.canton.network/overview/reference/external-party)
hosted on the app's own validator. Hosting is what makes the app's Daml package available to the
party and puts this participant among its confirmers; signing stays with a key only the user holds.
The backend prepares each transaction, the browser signs the hash, the backend executes. Nothing
on the server can act for a user — and the browser does not take the server's word for what it
is signing: `src/lib/verify.ts` decodes the prepared transaction, recomputes the hash with the
same code the SDK uses for offline signing, and refuses to sign unless the bytes exercise the
choice the page asked for, on the contract the page is looking at, with the arguments the page
built, acting as the user's party alone. The same goes for the party topology at sign-up.

The server talks to the participant through `@canton-network/wallet-sdk`: party topology and
allocation, interactive submission, the ACS. Its offline-signing shape (`.topology()` to get the
hash, `.execute(signature)` to commit) is exactly the split above. The SDK owns nothing on the
browser side — its key handling is a random `tweetnacl` pair — so the phrase, derivation and
encrypted storage are this app's own, in `src/lib/wallet.ts`.

The key comes from a twelve-word recovery phrase (BIP-39, SLIP-0010 at `m/44'/6767'/0'/0'/0'` —
6767 is Canton Coin's SLIP-0044 index). Canton derives an external party's id from the key's
fingerprint, so the phrase alone brings the same party back on any device. Between visits the key
rests in `localStorage` encrypted with AES-GCM, unlocked by a passkey (Touch ID and the like,
through the WebAuthn PRF extension) or a password (PBKDF2). A passkey cannot sign a Canton
transaction itself — WebAuthn wraps what it signs, and Canton verifies a bare signature over the
hash — which is why it guards the key instead of replacing it.

Why not a third-party wallet? It was measured rather than assumed: a dApp with its own Daml
templates cannot serve a party hosted by another wallet's participant. The package has to be on
the hosting participant, CIP-0103 exposes no method to upload one or to re-host a party, and
`signMessage` signs UTF-8 text rather than the transaction hash. Real tokens are a different story:
the token standard's packages are on every validator, so a balance can be paid in from any wallet.

### The model

`daml/src/Main.daml`, package `syncvotes-books`, one idea: every contract a user acts on
already carries the provider's signature, so the provider is a **confirmer** of every
transaction — which is what CIP-0104 pays traffic rewards for — while the user's key is the
only one that ever signs a submission. One constraint: a DAO may have thousands of members and
more proposals, so nothing lists, nothing grows with history, and a member's vote touches no
contract another member's vote touches. And one rule of authority: a DAO is signed by its
creator and the provider, and that pair is the DAO's own authority — every member, proposal,
ballot and comment of the DAO carries both signatures, with the creator cross-checked wherever
one contract refers to another, so neither the provider nor the creator can invent a member or
a vote alone; and the choices only the DAO may exercise (removing a member, recording a
proposal carried out) are controlled by both, and neither has the other's key.

- `Account` — created by the provider once per party; the door through which it creates DAOs
  (`Account_CreateDAO`) and keeps a `Profile` (`Account_SetProfile`: a name, a picture by link,
  a few words). A party is its hint plus its key's fingerprint (`alice::1220…`); a returning
  key is found by the fingerprint alone.
- `DAO` — signatory creator and provider: name, description (Markdown), a picture, a stable
  `id`, whether it votes by membership (`equal`), two `Settings` — for routine proposals (a
  decision, a name) and for sensitive ones (members and shares, the settings, dissolution): the rule each passes by and how many days its vote is open, set at
  the founding — a member count and the size of the vote in `units`. One choice, `DAO_Execute`, which carries out what a vote
  decided, a batch of entries at a time; nobody changes it by hand. No member list. Founded
  with a share table: the first two hundred members are created on the spot, the rest as a
  proposal already passed, carried out in batches like any other.
- `Member` — one per party per DAO, with its `share` of the vote in whole units (one each in a
  DAO by membership) and when that share last changed, signed by the DAO's authority (creator
  and provider), so nobody invents members alone; reshared or removed only with the same. It is the member's door to
  proposing — `Member_Propose` reads the DAO of the moment (the app's operator reads alongside
  the member) and fixes its units into the proposal as the electorate — to commenting
  (`Member_Comment`), and their ballot box: `Member_Vote` replaces it with a copy that
  remembers the proposal, so a second ballot is impossible unless the proposal lets votes
  change, in which case the ballot being replaced is handed in and withdrawn.
- `Proposal` — signatory proposer, provider and creator; counters, not lists: `yes`, `no`, `abstain` (in
  units, of `eligible`), `outcome`, how far its effect is carried out; an `Effect`: `Signal`,
  `SetShares` (only the parties it touches, zero to leave; up to two thousand, carried out two
  hundred at a time), `SetInfo` (name, description, picture), `Dissolve` or `SetSettings` (both
  settings from then on); and the `Rule` and deadline it runs under, which the proposer does not
  choose: `Member_Propose` takes them from the DAO's settings for the action's category
  (`isSensitive`), so nobody removes a member on a rule of their own making. A
  rule is yes measured against all of the vote or against the votes cast, a majority, a
  fraction (two thirds of three is two) or a percentage, a quorum of the vote that must take part, whether it settles the moment the
  outcome cannot change, and whether votes may change until the deadline — the last two
  exclude each other, which the ledger checks (an outcome that is sure only while nobody
  changes their mind is not sure). Settings change only by a sensitive proposal, passed under
  the sensitive settings as they stand. Nobody cancels a proposal. Once passed, the provider exercises `DAO_Execute`: the ledger checks
  the proposal did pass and carries the effect out with the DAO's authority; a dissolution
  archives the DAO at once — what was open is moot, the record stays readable.
- `Ballot` — one vote weighing the voter's units, signed by the voter, the provider and the
  DAO's creator. The provider counts (`Proposal_Tally`, batches of two hundred; where votes may
  change, only once the deadline has passed; the final count three minutes after the deadline,
  so a ballot signed at the last moment still lands) and `Ballot_Count` checks each ballot against its proposal: right DAO
  and proposal, cast before the deadline, under the same rule, by a member of the time whose
  share has not changed since the proposal was made — so a share moved during a vote never
  votes twice — not counted before. The provider can delay a result, never change it.
- `Comment` — a member's words on a proposal, signed by the author, the provider and the
  creator; the author edits or removes it, nobody else. Comments and proposals are paced by
  the app (thirty writes an hour per party), since the DAO pays for them.
- `Meter` — the provider's statement of a DAO's account: what was paid in for it, and what
  its traffic has cost.

The model's claims are checked in Daml Script (`daml/test/daml/Test.daml`, run by `dpm test`
in the DAR build stage, so a failing claim fails the build): a decoy ballot naming another
deadline is refused at the count, as is one cast after the deadline or a second one where
votes cannot change; nobody creates a member alone; a share change names each party once;
a dissolution archives the DAO and nothing is proposed on it after; settings the ledger
refuses; a comment only its author edits or deletes, the provider included.

### The balance

The sending validator pays the network for every byte of traffic, in coin at a published price
(\$60 per megabyte on TestNet; a governance transaction is a few kilobytes, about 20–30 cents;
a coin transfer about 7.5 kilobytes). The participant reports what each transaction cost
(`paidTrafficCost`), and the DAO it was for is charged that, times `BILLING_FACTOR` (one until
the rewards this traffic earns are measured). The balance is paid in by sending Canton Coin to
the provider's party from any wallet with the DAO's memo as the transfer's reason
(`syncvotes:<dao id>`, shown on the DAO's page); the provider has a transfer pre-approval, so
coin lands in one step, and accepts what a wallet sends as a transfer instruction instead.
What arrived with a memo is read off the provider's own transactions (the token standard's
view of them) and credited to the DAO's `Meter`, so the figure is the ledger's, recomputed on
a restart. What a DAO can spend is what was paid in less what it was charged; a write for a
DAO with nothing left is refused. What is paid in is spent on traffic and is not paid back:
the DAO holds no coin, and nothing leaves the provider on a DAO's behalf. Users hold no coin in
the app; a profile is the party's own transaction, not a DAO's.

The trust here is the trust the DAO already places in the provider that counts its votes and
carries out its decisions: the ledger records what was decided and what was done, and the app
is what does it. What the provider cannot do: invent a member, a ballot or a proposal (the
creator's signature is on each), change a count (the ledger checks every ballot it is handed)
or pass anything measured against the whole vote by leaving ballots out. What it can do: delay,
and — where a rule is measured against the votes cast, or has a quorum — fail or flip a result
by omitting ballots at the final count; the hints on those two settings say so. A treasury of
the DAO's own — a party the app acts for, paid out by vote — was built and audited (git
history at `9d8a00b`) and can come back if a DAO ever needs to hold coin.

## Setup

There is no local run: the only ledger this app talks to is its validator on TestNet, and the only
way to run it is `pnpm deploy:testnet`. What runs locally is the type-checker, the linter and the
build, and for that `daml.js/` has to exist — it is generated and gitignored, so a fresh clone
produces it before pnpm can resolve `@daml.js/model`. Codegen first, install second:

```sh
pnpm daml:codegen   # builds the DAR and writes daml.js/
pnpm i
pnpm check          # svelte-check over the whole app
pnpm lint
pnpm exec vite build   # what the image build runs; catches what the checker cannot
```

## Authentication

Every ledger call is authenticated — the participant, the validator backend and this app all
trust one Keycloak realm (`keycloak/realm.json`, served under `/auth` on `APP_DOMAIN` by the same
Caddy, its values substituted from the env file at import). There is no dev mode, no shared
secret, no `unsafe` HS256: tokens are RS256, checked against the realm's JWKS.

Three OAuth clients matter: `validator-app-backend` and `syncvotes-app` (client credentials, each
a service account whose fixed `sub` is its ledger user name) and `wallet-web-ui` / `cns-ui`
(public, PKCE) for the validator's own UIs, where the operator logs in as `WALLET_USER_NAME`. The
`daml_ledger_api` scope stamps the ledger audience (`https://canton.network.global`) into a token;
the validator's own API uses `VALIDATOR_AUDIENCE`.

The app's ledger user holds, once per validator: `ParticipantAdmin` (DAR upload, party
allocation), `CanReadAsAnyParty`, `CanExecuteAsAnyParty`, `CanReadAs` the operator and
`CanActAs` the provider. Nothing on user parties themselves — `CanActAs` is never granted, so
the only way a user's transaction gets submitted is with the user's own signature.
`CanReadAsAnyParty` is not optional: the participant refuses to _prepare_ a transaction for a
party the calling user cannot read as (`PERMISSION_DENIED: Claims do not authorize to read
data for party`), and reads are the one thing this design leaves open.

The validator bundle's `.env` points at the same realm (`AUTH_URL`, `AUTH_JWKS_URL`,
`AUTH_WELLKNOWN_URL`, `LEDGER_API_AUTH_AUDIENCE`, `VALIDATOR_AUTH_CLIENT_ID/SECRET`,
`LEDGER_API_ADMIN_USER`, `WALLET_ADMIN_USER`, the UI client ids) and is restarted with
`start.sh … -a`. Anything else that used to talk to the participant without a token — other
agents, consoles, gRPC pollers — needs a client in the realm from then on.

The SDK fetches its token with the client credentials and refreshes it when it expires (the realm
issues five-minute tokens). The update-stream websocket carries the same token as a subprotocol
(`jwt.token.<jwt>` next to `daml.ws.auth`), which works with RS256 tokens as it did with short
ones.

## How the two languages meet

`daml/src/Main.daml` is the source of truth. `pnpm daml:codegen` compiles it to a DAR and runs
`dpm codegen-js`, which writes TypeScript packages into `daml.js/` — wired in as a pnpm workspace so
`@daml.js/model` resolves like any dependency. Re-run it after every change to the Daml side,
followed by `pnpm i`: codegen wipes `daml.js/` so a stale package can never linger, and that takes
the generated packages' own links with it until pnpm relinks them.

Codegen names its output `@daml.js/<name>-<version>` from `daml/daml.yaml` — neither `-s` nor the
`codegen:` stanza can drop the version from that name. So package.json aliases it once, under
`@daml.js/model`, and everything else uses the alias or a glob. Bumping the version means editing
`daml/daml.yaml` and that one alias line.

`Main.Proposal.templateId` is `#syncvotes-books:Main:Proposal` — the package-name-scoped id the
ledger accepts in commands and ACS filters, which is what keeps a package upgrade from breaking
submissions. `verify.ts` takes the package name from the same place.

## Layout

| Path                                     | What it is                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `daml/src/Main.daml`                     | `Account`, `DAO`, `Member`, `Proposal`, `Ballot` — the whole model                       |
| `daml.js/`                               | Generated bindings — never edit, regenerate with `pnpm daml:codegen`                     |
| `src/lib/wallet.ts`                      | Phrase → signer closure; any number of keys encrypted at rest per device                 |
| `src/lib/auto-lock.ts`                   | Says when the key has been idle for 15 minutes, or the page is being left                |
| `src/lib/wallet-store.svelte.ts`         | The wallet as one rune store: onboarding screens, signer, identity                       |
| `src/lib/verify.ts`                      | Recomputes hashes and inspects transactions before anything is signed                    |
| `src/lib/schemas.ts`                     | One valibot schema per field and the batch size; browser and server check the same       |
| `src/lib/forms.ts`                       | signedForm(): submit, verify the prepared transaction against the fields, sign, go on    |
| `src/lib/actions.ts`                     | What the browser does: call the API, verify, sign, call again; member batches            |
| `src/lib/api.remote.ts`                  | The server API as remote functions: reads, forms, prepares, execute                      |
| `src/lib/server/participant.ts`          | The participant: topology, allocation (single or multi-key), prepare and execute         |
| `src/lib/server/ledger.ts`               | The provider's copy of the ledger in memory, fed by the update stream, with wake-ups     |
| `src/lib/server/tally.ts`                | The provider's jobs: Proposal_Tally in batches, DAO_Execute for what passed              |
| `src/lib/server/splice.ts`               | Canton Coin: the rules, the open round and prices, from public Scan                      |
| `src/lib/server/deposits.ts`             | Coin at the provider: its pre-approval, accepting transfers, deposits read by memo       |
| `src/lib/server/billing.ts`              | Traffic charged to the DAO that caused it; credited from deposits; the funds gate        |
| `src/lib/server/session.ts`              | Read sessions: a signed challenge behind an HttpOnly cookie                              |
| `src/routes/(app)/`                      | My DAOs, DAO, Create DAO, Proposal, Create proposal, Wallet                              |
| `src/routes/+page.svelte`                | The landing (v1's Consensus Engine), Tailwind on the markup, `field.ts`                  |
| `src/lib/components/ui/`                 | shadcn-svelte primitives only (button, badge, input, textarea, label)                    |
| `src/lib/components/`                    | Everything built on them: page column, panels, lists, forms, header, footer, `landing-*` |
| `src/lib/components/profile-form.svelte` | The party's name, picture and words, on the wallet page                                  |
| `src/lib/markdown.ts`                    | Markdown as the app renders it: marked, then DOMPurify in the browser                    |
| `compose.yaml`                           | The compose project for the servers, Caddy config inline                                 |

The private key exists only inside a closure (`Signer`): the page can ask it to sign, to encrypt
itself for storage, or to dispose — never to reveal itself. Every write is a transaction the
ledger will only accept with that key's signature, and the backend user is granted no rights on
user parties, so there is no second path. Before signing, `src/lib/verify.ts` decodes what the
server prepared and refuses anything but the asked-for choice, on the asked-for contract of this
package, with the asked-for arguments, acting as the user alone — and at sign-up, a party in the
key's own namespace, held by this key alone, hosted for confirmation only. What is asked for
comes from the page: a form's intent is built from its own fields (as the shared schema trims
them) and the contract it is showing, never from the server's reply. The server, in turn,
executes only transactions it prepared itself, so its own rules cannot be bypassed.

Reads need a session. A DAO is private to the _network_ by construction, and this app — as
operator — sees all of them; what keeps a DAO to its members on the way to a browser is the app.
Once per unlock the browser signs a challenge with the party's key (`sessionChallenge` /
`sessionStart`), the server checks the signature against the key the party id names and keeps a
session in memory behind an HttpOnly cookie (`src/lib/server/session.ts`). Every read and every
prepare takes its party from that session; the DAO, proposal and my-DAOs reads require
membership too. Only the landing counts and the party lookup stay open. A live query that loses
access ends with that error rather than freezing a stale view; a session lost while the key is
still unlocked (a restart, another tab locking) is re-signed on the spot and the query
reconnected. A restart forgets sessions; the browser, still holding the key, signs again on its
next unlock.

Reads are live and never touch the participant. The server keeps an in-memory copy of every
contract the operator sees (`ledger.ts`) — built from the JSON API's streaming active-contracts
endpoint at startup (the list endpoint stops at two hundred elements) and kept current from the
update stream. Each contract goes into the maps the pages read, together with the one closure
that takes it out again when it is archived; a transaction wakes whoever waits on the DAO,
proposal or party it touched. Every read is a SvelteKit live query over those maps: it sends its
value, then sends it again whenever its key fires and the value changed. Lists are paged and
filtered on the server (members and ballots by party id, proposals by status). A write's
`execute` returns only once the copy holds its transaction, so the page that just signed is
already up to date. Pages neither poll nor refresh; another member's vote lands on your screen
as it lands on the ledger.

Measured on TestNet with 221 members: adding 220 members is two signed transactions, 13 seconds
in all; creating a proposal and opening the vote for all of them is two more, 13 seconds; 40
members voting at once take 45 seconds with no conflicts; the provider has counted them within 3
seconds.

There is no login. The key is the identity: a party id is the hint the user chose plus the key's
fingerprint, so a registered key is recognised by its fingerprint alone, and every write carries a
signature the server cannot forge.

## Deployment

```sh
pnpm deploy:testnet   # either refuses an uncommitted tree: what runs is always a commit
pnpm deploy:mainnet
```

Each is `docker compose build && up -d` against a Docker context named `syncvotes-<network>`: the
commands run here, that server's Docker daemon executes them, and the build context — this
working tree, minus `.dockerignore` — travels over SSH. Nothing lives on a server but Docker and
the validator: no checkout, no runner, no CI. Compose reads `<network>.env` (template in
`.env.example`) locally and bakes the values into the container's environment; the file
itself never leaves this machine.

The servers' addresses are not in the repository. Once per machine and network:

```sh
docker context create syncvotes-testnet --docker host=ssh://<user>@<server>
```

The commit is baked into the image as `GIT_SHA`, and `/version` answers with it — that is how to
see what is running where. Runtime dependencies are the generated Daml bindings and the wallet SDK (it
ships CommonJS that breaks when bundled into an ES module); adapter-node bundles everything else
into `build/`.

Caddy's config is inline in `compose.yaml` (a compose `configs` entry with `content:`) rather than
bind-mounted — a host path would be resolved on the server, where this tree does not exist. A change
to that content does not make `compose up` recreate the container: after one, run
`docker --context syncvotes-testnet compose --env-file testnet.env up -d --force-recreate caddy`.
The site sits behind Cloudflare, and Caddy is what works the visitor's address out: Cloudflare's
published ranges are its trusted proxies, so a request that came through Cloudflare is known by
the address in Cloudflare's header and one that reached the origin directly by the connection
itself; the app reads only the `X-Client-Ip` Caddy sets (sign-ups are paced by it), so a header a
visitor made up counts for nothing.

Building on the server is deliberate: it is amd64, the laptop is not, and the layer cache is there.

`compose.yaml` is a separate compose project that joins the Splice validator's network — the validator
has its own `start.sh`, which does more than `compose up`, so a deploy must never recreate its
containers. Caddy binds the public IP because the validator's nginx already holds `:80` on
loopback. The app reaches the participant directly at `participant:7575` on that network.

The DAR is built inside the image, and the app uploads it on startup (`src/hooks.server.ts`) —
idempotent by package id — so the code and the package it needs always land together.

## Notes

- An external party's namespace is the fingerprint of its own key, so the party id is a pure
  function of the phrase — look it up with `/v2/parties/{id}`, never by listing: a shared network
  has tens of thousands of parties.
- Canton 3.5 names the ed25519 key spec `SIGNING_KEY_SPEC_EC_CURVE25519`; the signature algorithm
  is still `SIGNING_ALGORITHM_SPEC_ED25519`.
- The SDK submits through `interactive-submission/executeAndWait`, so by the time a command
  returns the ledger has accepted it; the update stream brings it to the in-memory copy a moment
  later, which `execute` waits for. It also hardcodes `HASHING_SCHEME_VERSION_V2`, which is what
  the participant returns today.
- `@canton-network/core-tx-visualizer` is the SDK's hashing and decoding, on its own: 168 KB,
  browser-safe, and what `verify.ts` builds on. Its `validateAuthorizedPartyIds` only understands
  create nodes and throws `Unsupported` on an exercise, so the authority check is written by hand
  from the decoded nodes instead.
- The SDK's token providers log the whole token response at info level — the self-signed one
  its JWTs, the client-credentials one Keycloak's reply. `participant.ts` gives it a log adapter
  that passes only warnings and errors, and only their message.
- A package name and version can be uploaded once, and a later version under the same name must
  be a compatible upgrade (fields can only be added, and as `Optional`). A change that is not —
  a template dropped, a field made mandatory — needs a new package name, which is why the model
  has changed name with every incompatible step and is `syncvotes-books` now.
- A `.remote.ts` module may export nothing but remote functions — a shared constant next to
  them fails the build, which is why the batch size lives in `schemas.ts`.
- The kit's `form.fields.value()` knows only the fields the user touched; `forms.ts` reads the
  submitted values from the form element instead, so an untouched description is still part of
  what the browser verifies.
- `dpm codegen-js` emits CommonJS. Vite does not pre-bundle workspace-linked packages by default, so
  `optimizeDeps.include` in `vite.config.ts` is what stops the browser receiving raw CJS.
- The participant prepares one command per interactive submission, and a prepared transaction
  times out about two minutes after it was prepared whatever `maxRecordTime` says. An interactive
  submission cannot act as a local party alongside the external one; delegation goes through
  Daml.
- The JSON API wants an `Int` as text and a `Decimal` with its full scale; the browser compares
  what it decodes against what the page meant, so the page writes them the same way.
- Nothing grows with use. A member's contract remembers only the proposals it voted on whose
  deadline has not passed (nothing can be cast after one), so a vote's transaction is the size
  of that member's open business, not their history; the DAO holds a count, a proposal holds
  counters, and every batch (members, ballots) is a fixed size. Transaction size is what a
  validator pays for, so it is what the model is shaped around.
