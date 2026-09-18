# syncvotes

On-chain governance for the Canton Network: private DAOs, proposals and votes, signed by a key
only the member holds. MVP v2, running against its own validator on TestNet at
<https://dev.syncvotes.com>.

A DAO here is private to its members, run by its admins, and decides by member or by stake:
proposals carry an effect — a signal, a payout from the DAO's treasury, members joining or
leaving, a new set of admins — that the ledger carries out once the vote has passed. The
treasury is a party the admins' keys own together, with a threshold of them behind every
payout. Every transaction a DAO causes is paid from a balance it tops up in Canton Coin, at the
traffic the network charged for it.

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
the token standard's packages are on every validator, so a treasury can be paid from any wallet.

### The model

`daml/src/Main.daml`, package `syncvotes-charter`, one idea: every contract a user acts on already
carries the provider's signature, so the provider is a **confirmer** of every transaction — which
is what CIP-0104 pays traffic rewards for — while the user's key is the only one that ever signs
a submission. One constraint: a DAO may have thousands of members and more proposals, so nothing
lists, nothing grows with history, and a member's vote touches no contract another member's vote
touches. And one rule of authority: a DAO is signed by its creator and the provider, and that
pair is the DAO's own authority — the choices only the DAO may exercise (removing a member,
marking a proposal executed, voiding a payout) are controlled by both, and neither has the other's
key.

- `Account` — created by the provider once per party, remembering the party's public key; the
  door through which it creates DAOs. A party is its hint plus its key's fingerprint
  (`alice::1220…`); a returning key is found by the fingerprint alone. At sign-up the party also
  accepts a transfer pre-approval the validator offers it, so coin sent to it simply lands.
- `DAO` — signatory creator and provider, observed by its `admins`: name, description, a stable
  `id`, a member count, how it votes (`ByMember`, or `ByStake` with an instrument and a quorum),
  and its treasury if it has one. Any admin changes any of it; admins are chosen at creation
  (from among the members), by an admin, or by a vote. No member list.
- `Member` — one per party per DAO, signed by whoever admitted the member (the creator, an admin,
  or the DAO itself carrying out a vote), so the provider cannot invent members; removed only
  with the DAO's authority. It is the member's door to proposing — `Member_Propose` reads the DAO
  of the moment (the app's operator reads alongside the member) and fixes its rules and member
  count into the proposal — and their ballot box: `Member_Vote` replaces it with a copy that
  remembers the proposal, so a second ballot is impossible, and creates a `Ballot`. In a stake
  DAO the vote names the voter's own locked holdings; the ledger reads their weight through the
  token standard's `Holding` interface and refuses any not locked past the deadline.
- `Proposal` — signatory proposer and provider; counters, not lists, in `Decimal`; an `Effect`
  (`Signal`, `Payout`, `SetMembers`, `SetAdmins`); the voting rule and electorate as they were
  when it was made. A member vote passes at a majority of eligible, fails when no makes that
  impossible, and is decided by the ballots cast at the deadline; a stake vote is decided at the
  deadline only, yes against no, once the quorum took part. Cancelled by the proposer or an admin
  until settled. Once passed, the provider exercises `DAO_Execute`: the ledger checks the proposal
  did pass and carries the effect out with the DAO's authority — members join or leave, admins
  change, or a `PayoutDue` appears for the treasury.
- `Ballot` — one vote with its weight and instrument, signed by the voter and the provider. The
  provider counts (`Proposal_Tally`, batches of two hundred) and `Ballot_Count` checks each ballot
  against its proposal: right DAO and proposal, cast before the deadline, by a member of the
  time, the DAO's instrument, not counted before. The provider can delay a result, never change
  it.
- `PayoutDue` — what a passed payout leaves for the treasury. Settling it is the transfer itself:
  the treasury hands in the coin's transfer factory and the transfer, the ledger checks that
  transfer is this payout (from the treasury, to the party, for the amount) and makes it through
  the token standard. Paid exactly once, never anything else.
- `Meter` — the provider's statement of a DAO's account: coin paid in, traffic charged.

### Stake, treasury, balance

**Stake** is coin locked in the voter's own wallet: an `AmuletRules_Transfer` to oneself whose
output carries a lock with no holders, so nothing but its expiry opens it
(`LockedAmulet_OwnerExpireLockV2`). It never moves and nobody holds it; a vote weighs the locks
that outlast the proposal's deadline, so the same coin cannot vote twice. (Token-standard
allocations were tried first and rejected: the sender can withdraw one at any time.)

**Treasury.** Canton lets a party be owned by several keys with a threshold, and that is what a
treasury is: `server/treasury.ts` writes the topology by hand from the protos — a root certificate
per admin, a decentralized namespace they own together, and the party hosted here with their keys
as its signing set — and every admin's browser (`verify.ts`) checks the bytes say exactly that
before signing the multi-hash. The validator then offers the new party a transfer pre-approval,
which a threshold of admins accept, and coin sent to it lands. A prepared transaction lives about
two minutes on the network and the participant prepares one command at a time, so a payout is a
**signing session**: the first signer's browser opens it, the others sign the same preparation,
and it executes the moment the threshold is met. The network offers no way to change a party's
keys, so when the admins change the treasury is rebuilt and its signers move the coin.

**Balance.** The sending validator pays the network for every byte of traffic, in coin at a
published price (\$60 per megabyte on TestNet; a vote is a few kilobytes, a coin transfer or a
lock some thirty, because the rules they disclose travel with them). The participant reports what
each transaction cost (`paidTrafficCost`), and the DAO it was for is charged that, times
`BILLING_FACTOR` (one until the rewards this traffic earns are measured). Coin is paid in by
sending it to the provider from the DAO page; the `Meter` on the ledger holds the account, and a
write for a DAO with nothing left is refused — except winding it up.

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

`Main.Proposal.templateId` is `#syncvotes-vote:Main:Proposal` — the package-name-scoped id the
ledger accepts in commands and ACS filters, which is what keeps a package upgrade from breaking
submissions. `verify.ts` takes the package name from the same place.

## Layout

| Path                             | What it is                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `daml/src/Main.daml`             | `Account`, `DAO`, `Member`, `Proposal`, `Ballot` — the whole model                       |
| `daml.js/`                       | Generated bindings — never edit, regenerate with `pnpm daml:codegen`                     |
| `src/lib/wallet.ts`              | Phrase → signer closure; any number of keys encrypted at rest per device                 |
| `src/lib/auto-lock.ts`           | Says when the key has been idle for 15 minutes, or the page is being left                |
| `src/lib/wallet-store.svelte.ts` | The wallet as one rune store: onboarding screens, signer, identity                       |
| `src/lib/verify.ts`              | Recomputes hashes and inspects transactions before anything is signed                    |
| `src/lib/schemas.ts`             | One valibot schema per field and the batch size; browser and server check the same       |
| `src/lib/forms.ts`               | signedForm(): submit, verify the prepared transaction against the fields, sign, go on    |
| `src/lib/actions.ts`             | What the browser does: call the API, verify, sign, call again; member batches            |
| `src/lib/api.remote.ts`          | The server API as remote functions: reads, forms, prepares, execute                      |
| `src/lib/server/participant.ts`  | The participant: topology, allocation (single or multi-key), prepare and execute         |
| `src/lib/server/ledger.ts`       | The provider's copy of the ledger in memory, fed by the update stream, with wake-ups     |
| `src/lib/server/tally.ts`        | The provider's jobs: Proposal_Tally in batches, DAO_Execute for what passed              |
| `src/lib/server/splice.ts`       | Canton Coin: Scan, holdings, transfer/lock/release commands, validator pre-approvals     |
| `src/lib/server/billing.ts`      | Traffic charged to the DAO that caused it; the Meter; the funds gate                     |
| `src/lib/server/treasury.ts`     | The multi-key party's topology, the setup ceremony, signing sessions                     |
| `src/lib/server/session.ts`      | Read sessions: a signed challenge behind an HttpOnly cookie                              |
| `src/routes/(app)/`              | My DAOs, DAO, Create DAO, Proposal, Create proposal, Wallet                              |
| `src/routes/+page.svelte`        | The landing (v1's Consensus Engine), Tailwind on the markup, `field.ts`                  |
| `src/lib/components/ui/`         | shadcn-svelte primitives only (button, badge, input, textarea, label)                    |
| `src/lib/components/`            | Everything built on them: page column, panels, lists, forms, header, footer, `landing-*` |
| `compose.yaml`                   | The compose project for the servers, Caddy config inline                                 |

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
bind-mounted — a host path would be resolved on the server, where this tree does not exist.

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
  has changed name with every incompatible step and is `syncvotes-charter` now. The
  token-standard DARs it depends on are the validator's own (`daml/lib/`), so the package ids
  match the network's; a `.dalf` fetched from the participant is a bare payload damlc will not
  take.
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
