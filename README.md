# syncvotes

On-chain governance for the Canton Network: DAOs, proposals and votes, signed by a key only the
member holds. One image runs on three networks, each against its own validator:
<https://syncvotes.com> (MainNet), <https://test.syncvotes.com> (TestNet),
<https://dev.syncvotes.com> (DevNet).

A DAO is run by nobody: who is in it and with what share of the vote, what it is called, its
settings, whether it is public, whether it goes on — all decided by vote and carried out by the
ledger. The creator is just that. A DAO votes by membership (one member, one vote) or by shares
(whole units, like shares of a company). A proposal is a yes-or-no question, a choice among
options, or one of the changes above. It holds no coin: everything costs network traffic, paid
from a balance topped up by sending Canton Coin to the app with a memo. Proposals and
descriptions are Markdown; every proposal has a comment thread; a member may keep a profile.

## Architecture

Every user is an [external party](https://docs.canton.network/overview/reference/external-party)
hosted on the app's own validator: hosting is what makes the app's Daml package available to the
party, signing stays with a key only the user holds. The server prepares each transaction, the
browser signs the hash, the server executes. The browser does not take the server's word for
what it is signing: `src/lib/verify.ts` decodes the prepared transaction, recomputes the hash the
way the SDK does for offline signing, and refuses anything but the choice the page asked for, on
the contract the page shows, with the arguments the page built, acting as the user alone. The
same goes for the party topology at sign-up.

The server talks to the participant through `@canton-network/wallet-sdk` (topology, allocation,
interactive submission, the ACS). The key side is the app's own (`src/lib/wallet.ts`): a
twelve-word phrase (BIP-39, SLIP-0010 at `m/44'/6767'/0'/0'/0'`) gives an ed25519 key; Canton
derives the party id from the key's fingerprint, so the phrase alone brings the same party back
on any device. Between visits the key rests in `localStorage` encrypted with AES-GCM, unlocked by
a passkey (WebAuthn PRF) or a password (PBKDF2); a passkey cannot sign a Canton transaction
itself, so it guards the key instead of replacing it.

Why not a third-party wallet: measured, not assumed. A dApp with its own Daml templates cannot
serve a party hosted on another wallet's participant — the package has to be on the hosting
participant, CIP-0103 has no method to upload one or re-host a party, and `signMessage` signs
text, not a transaction hash. Coin is different: the token standard is on every validator, so a
balance can be paid in from any wallet.

### The model

`daml/src/Main.daml`, package `syncvotes-options`. Every contract a user acts on carries the
provider's signature, so the provider confirms every transaction (what CIP-0104 pays traffic
rewards for) while only the user's key ever signs a submission. A DAO is signed by its creator
and the provider, and every member, proposal, ballot and comment carries both, cross-checked, so
neither can invent one alone. Nothing lists and nothing grows with history: a DAO may have
thousands of members, and one member's vote touches no contract another's does.

- `Account` — one per party, made by the provider; creates DAOs and keeps a `Profile`. A party
  is its hint plus its key's fingerprint (`alice::1220…`).
- `DAO` — name, description, picture, stable `id`, `equal` (by membership) or units of the
  vote, `public`, `actorPays`, two `Settings` (routine and sensitive proposals: the rule and
  the voting period). `DAO_Execute` carries out what a vote decided, in batches; nobody changes
  a DAO by hand. Founded with a share table: the first two hundred members at once, the rest as
  a proposal already passed.
- `Member` — one per party per DAO, with its share and when that share last changed. The
  member's door to proposing (`Member_Propose` fixes the DAO's units as the electorate and
  takes the rule from the DAO's settings for the action's category), commenting and voting
  (`Member_Vote` remembers the proposal, so a second ballot is impossible unless votes may
  change, in which case the old one is withdrawn).
- `Proposal` — counters, not lists: `yes`, `no`, `abstain`, `tallies` per option, `eligible`,
  `outcome`, how far its effect is carried out. Effects: `Signal`, `Choose` (two to ten
  options; the leader wins if it reaches what a yes would need, a tie decides nothing — or,
  with `several`, each member picks any number and every option that reaches the rule is
  chosen, measured against the ballots that picked anything where the rule counts the votes
  cast), `SetShares`, `SetInfo`, `SetSettings`, `SetPublic`, `Dissolve`. A rule is yes against
  the whole vote or the votes cast, a majority, a fraction or a percentage, a quorum, whether
  it settles as soon as the outcome cannot change, whether votes may change until the deadline
  (the last two exclude each other). Nobody cancels a proposal. A proposal may be a `secret`
  ballot: the app shows nobody a vote but their own; the ballots are on the ledger all the
  same, and the provider, which counts them, sees them.
- `Ballot` — one vote weighing the voter's units. The provider counts in batches
  (`Proposal_Tally`; a final count three minutes after the deadline) and `Ballot_Count` checks
  each ballot: right DAO and proposal, cast in time, under the same rule, by a member of the
  time whose share has not changed since. The provider can delay a result, never change it.
- `Comment` — said once and kept as said; nobody edits or removes it. Comments and proposals
  are paced by the app (thirty writes an hour per party).
- `Meter` and `Purse` — the provider's statement of a DAO's and a party's account: paid in,
  charged.

### Invites and visibility

Sign-up is by invitation while `INVITE_CODES` names any codes (comma-separated); a code is
asked for before anyone pays for a party and checked again when the party is made. Empty, the
door is open. A DAO is private unless founded public or made so by a sensitive `SetPublic`
vote: public DAOs are listed at `/daos` for anyone signed in to read (proposals, outcomes,
members, comments), while only members act and who voted how stays with the members. Nothing
is public on the Canton network itself; "public" is the app reading as operator for whoever
asks.

### The balances

The validator pays the network for every byte of traffic. The participant reports what each
transaction cost, and the payer is charged that times `BILLING_FACTOR` (one). Two kinds of
account, paid in the same way: a DAO's (`Meter`) and a party's own (`Purse`, by fingerprint).
A DAO founded with "the DAO pays" pays for everything done in it; one founded with "each
member pays" has no balance, and a proposal, a vote or a comment costs the member who signs
it, the counting of a proposal its proposer. A party pays for itself in any case: its
allocation, its profile, the DAOs it founds. Nothing is spent for a new party before its owner
has paid: the wallet page shows the memo of the key and what a party costs today, and the party
is made once that much has arrived. Before signing anything, the participant's own estimate is
checked against the payer's balance.

A balance is paid in by sending Canton Coin to the provider's party from any wallet with the
memo as the transfer's reason (`syncvotes:<dao id>` or `syncvotes:<fingerprint>`). The provider
has a transfer pre-approval (renewed twenty days before it runs out), so coin lands in one step.
What arrived with a memo is read off the provider's own transactions and recomputed on a
restart; the ledger's figure is the only figure. What is paid in is spent on traffic and is not
paid back: the DAO holds no coin, and nothing leaves the provider on a DAO's behalf.

What the provider cannot do: invent a member, a ballot or a proposal, change a count, or pass
anything measured against the whole vote by leaving ballots out. What it can: delay, and, where
a rule is measured against the votes cast or has a quorum, fail or flip a result by omitting
ballots at the final count; the hints on those settings say so.

## Setup

There is no local run: the only ledger the app talks to is a validator, so what runs locally is
the type-checker, the linter and the build. `daml.js/` is generated and gitignored, so a fresh
clone produces it before pnpm can resolve `@daml.js/model` (building the DAR needs Rosetta on
Apple silicon, `dpm` is x86_64):

```sh
pnpm daml:codegen      # builds the DAR and writes daml.js/
pnpm i
pnpm check
pnpm lint
pnpm exec vite build   # what the image build runs
```

Re-run codegen and `pnpm i` after every change to the Daml side. Codegen names its package
`@daml.js/<name>-<version>` from `daml/daml.yaml`; package.json aliases it once as
`@daml.js/model`, so a version bump is `daml/daml.yaml` and that one line. Template ids are
package-name-scoped (`#syncvotes-options:Main:Proposal`), which is what keeps an upgrade from
breaking submissions.

## Authentication

Every ledger call is authenticated: the participant, the validator backend and this app trust
one Keycloak realm (`keycloak/realm.json`, served under `/auth` on `APP_DOMAIN` by the same
Caddy, values substituted from the env file at import). Tokens are RS256, checked against the
realm's JWKS; the app reaches the realm over the compose network, the browser over the domain.

Clients: `validator-app-backend` and `syncvotes-app` (client credentials, each a service account
whose `sub` is its ledger user name), `wallet-web-ui` / `cns-ui` (public, PKCE) for the
validator's own UIs. The app's ledger user holds `ParticipantAdmin` (DAR upload, party
allocation), `CanReadAsAnyParty`, `CanExecuteAsAnyParty`, `CanReadAs` the operator and `CanActAs`
the provider, and never `CanActAs` a user party: the only way a user's transaction is submitted
is with the user's own signature. `CanReadAsAnyParty` is not optional: the participant refuses
to prepare for a party the caller cannot read as.

The validator bundle's `.env` points at the same realm (`AUTH_URL`, `AUTH_JWKS_URL`,
`AUTH_WELLKNOWN_URL`, the audiences and client ids) and is restarted with `start.sh … -a`;
pin `PARTICIPANT_DB_NAME` there before any recreate.

## How the app runs

The private key exists only inside a closure (`Signer`): the page can ask it to sign, to encrypt
itself for storage, or to dispose, never to reveal itself. The key is kept on the device before
the party is paid for, so a reload during the pay-in resumes it. A key that comes back without
an `Account` is looked up in an index of the parties this participant hosts, read once in the
background at startup (the participant's own list is the whole network's, over a million parties
on MainNet); a lookup during that first read waits up to a minute and then says try again.

Reads need a session: once per unlock the browser signs a challenge with the party's key, and
the server keeps a session in memory behind an HttpOnly cookie (`src/lib/server/session.ts`).
Every read and prepare takes its party from it; DAO reads require membership or a public DAO.
A restart forgets sessions; the browser, still holding the key, signs again.

Reads are live and never touch the participant. The server keeps an in-memory copy of every
contract the operator sees (`ledger.ts`), built from the streaming active-contracts endpoint at
startup and kept current from the update stream; a transaction wakes the live queries waiting on
the DAO, proposal or party it touched. Lists are paged and filtered on the server. A write's
`execute` returns once the copy holds its transaction, so the page that signed is already up to
date. Measured on TestNet with 221 members: 220 members added in 13 seconds, 40 members voting
at once in 45 seconds with no conflicts, counted within 3 seconds.

| Path                             | What it is                                                                  |
| -------------------------------- | --------------------------------------------------------------------------- |
| `daml/src/Main.daml`             | The whole model; `daml/upgrades/` the previous DAR                          |
| `daml.js/`                       | Generated bindings, never edited                                            |
| `src/lib/wallet.ts`              | Phrase → signer closure; keys encrypted at rest per device                  |
| `src/lib/wallet-store.svelte.ts` | The wallet as one rune store: onboarding screens, signer, identity          |
| `src/lib/verify.ts`              | Recomputes hashes and inspects transactions before anything is signed       |
| `src/lib/schemas.ts`             | One valibot schema per field; browser and server check the same             |
| `src/lib/actions.ts`, `forms.ts` | What the browser does: call the API, verify, sign, call again               |
| `src/lib/api.remote.ts`          | The server API as remote functions: live reads, forms, prepares             |
| `src/lib/server/participant.ts`  | The participant: topology, allocation, prepare and execute, the party index |
| `src/lib/server/ledger.ts`       | The provider's copy of the ledger, with wake-ups                            |
| `src/lib/server/tally.ts`        | The provider's jobs: counts in batches, `DAO_Execute` for what passed       |
| `src/lib/server/deposits.ts`     | Coin at the provider: pre-approval, transfers, deposits by memo             |
| `src/lib/server/billing.ts`      | Traffic charged to the account that caused it; the funds gate               |
| `src/lib/server/splice.ts`       | Canton Coin rules, round and prices, from Scan                              |
| `src/routes/(app)/`              | My DAOs, Public DAOs, DAO, members, proposals, people, wallet, terms        |
| `src/routes/+page.svelte`        | The landing, `landing-*` components                                         |
| `src/lib/components/`            | Everything built on the shadcn primitives in `ui/`                          |
| `compose.yaml`                   | The compose project for the servers, Caddy config inline                    |
| `scripts/setup-participant.mjs`  | Once per validator: the app's ledger user, the operator party, rights       |

## Deployment

```sh
pnpm deploy:testnet   # each refuses an uncommitted tree: what runs is always a commit
pnpm deploy:devnet
pnpm deploy:mainnet
```

Each is `docker compose build && up -d` against a Docker context named `syncvotes-<network>`
(`docker context create syncvotes-testnet --docker host=ssh://<user>@<server>`): the build
context travels over SSH and the server's daemon builds the image. Nothing lives on a server but
Docker and the validator. Compose reads `<network>.env` locally (template in `.env.example`,
the files never in git): the participant, the parties, the realm's secrets, `SCAN_URL`,
`NETWORK`, `BILLING_FACTOR`, `INVITE_CODES`, the proxy knobs. The commit is baked in as
`GIT_SHA`; `/version` answers with it.

`compose.yaml` joins the Splice validator's network and must never recreate its containers
(the validator has its own `start.sh`). Caddy serves the domain and the realm; behind Cloudflare
it works the visitor's address out from Cloudflare's ranges, and the app reads only the
`X-Client-Ip` it sets. Where a host's 80/443 belong to another proxy, `CADDY_HTTP_BIND` /
`CADDY_HTTPS_BIND` put Caddy on loopback, `CADDY_SITE` names the plain-HTTP site,
`CADDY_TRUSTED_EXTRA` trusts that proxy, and either traefik routes by the labels compose sets
(`TRAEFIK=true`, `PROXY_NETWORK`) or an nginx site forwards. Caddy's config is inline, so a
change to it needs `compose up -d --force-recreate caddy`. A deploy takes nothing down: Caddy
holds a request until the new app container answers.

The DAR is built inside the image and uploaded by the app at startup, which then checks the
package is on the participant. The package is a lineage, `syncvotes-options`, and its name never
changes: every release is a Canton Smart Contract Upgrade of the one before, checked by the
compiler against the previous DAR (`upgrades:` in `daml/daml.yaml`), so live contracts carry
over. Allowed: a choice's body, a new template or choice, an `Optional` field appended last. Not
allowed: removing or retyping a field or choice, changing signatories or observers, tightening
`ensure`. Release: bump the version, point `upgrades:` at the release before, keep that DAR in
`daml/upgrades/`.

## Notes

- Canton 3.5 names the ed25519 key spec `SIGNING_KEY_SPEC_EC_CURVE25519`; the signature
  algorithm is still `SIGNING_ALGORITHM_SPEC_ED25519`.
- The SDK submits through `interactive-submission/executeAndWait` and hardcodes
  `HASHING_SCHEME_VERSION_V2`. Its token providers log whole token responses at info level;
  `participant.ts` gives it a log adapter that passes only warnings and errors.
- `@canton-network/core-tx-visualizer` is what `verify.ts` builds on; its authority check only
  understands create nodes, so the check for exercises is written by hand.
- A prepared transaction times out about two minutes after it was prepared, whatever
  `maxRecordTime` says. An interactive submission cannot act as a local party alongside the
  external one; delegation goes through Daml.
- The JSON API wants an `Int` as text and a `Decimal` with its full scale; a variant with a
  payload arrives as `{tag, value}`. The list endpoints stop at two hundred elements.
- A `.remote.ts` module may export nothing but remote functions, which is why shared constants
  live in `schemas.ts`. `dpm codegen-js` emits CommonJS; `optimizeDeps.include` in
  `vite.config.ts` keeps the browser from receiving it raw.
