# syncvotes

On-chain governance for the Canton Network: private DAOs, proposals and votes, signed by a key
only the member holds. MVP v2, running against its own validator on TestNet at
<https://dev.syncvotes.com>.

The scope is deliberately the smallest thing that is real governance: a DAO with fixed members,
text proposals, one Yes/No vote per member, passed by a majority of all members, closed on-chain
as soon as that is settled. Everything else v1 had — typed actions, weights, veto, treasury — is
a later iteration.

## Architecture

Every user is an [external party](https://docs.canton.network/overview/reference/external-party)
hosted on the app's own validator. Hosting is what makes the app's Daml package available to the
party and puts this participant among its confirmers; signing stays with a key only the user holds.
The backend prepares each transaction, the browser signs the hash, the backend executes. Nothing
on the server can act for a user — and the browser does not take the server's word for what it
is signing: `src/lib/verify.ts` decodes the prepared transaction, recomputes the hash with the
same code the SDK uses for offline signing, and refuses to sign unless the bytes exercise the
asked-for choice on the app's proxy, acting as the user's party alone. The same goes for the
party topology at sign-up.

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

Three templates in `daml/src/Main.daml`, one idea: every contract a user acts on already carries
the provider's signature, so the provider is a **confirmer** of every transaction — which is what
CIP-0104 pays traffic rewards for — while the user's key is the only one that ever signs a
submission.

- `Account` — created by the provider once per party; carries the name others use to add you to a
  DAO, and the choice that creates DAOs.
- `DAO` — signatory admin and provider, observer members and operator. Private to its members by
  construction: nobody else on the network holds it. Membership is fixed at creation.
- `Proposal` — signatory proposer and provider. One ballot per member; passes when a majority of
  all members voted Yes; closable once settled or after the deadline. Each vote replaces the
  contract, so a proposal carries a stable `id` for the page to follow.

Two provider-side parties, as the Featured App Coupon Guidance asks (separate party concerns):
`PROVIDER_PARTY` holds the FeaturedAppRight, signs every proxy and is the one that earns;
`OPERATOR_PARTY` is the backend's own party, an observer on every proxy that reads the directory
and never earns. TestNet's DSO mints app rewards as `RewardVersion_TrafficBasedAppRewards`
(checked against round 114321), so no activity markers are involved; confirm the same on any
other network before counting on rewards there.

## Setup

There is no local run: the only ledger this app talks to is its validator on TestNet, and the only
way to run it is `pnpm deploy:testnet`. What runs locally is the type-checker and the linter, and for that
`daml.js/` has to exist — it is generated and gitignored, so a fresh clone produces it before pnpm
can resolve `@daml.js/model`. Codegen first, install second:

```sh
pnpm daml:codegen   # builds the DAR and writes daml.js/
pnpm i
pnpm check          # svelte-check over the whole app
pnpm lint
```

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

`Main.Proposal.templateId` is `#syncvotes-governance:Main:Proposal` — the package-name-scoped id the
ledger accepts in commands and ACS filters, which is what keeps a package upgrade from breaking
submissions.

## Layout

| Path                             | What it is                                                              |
| -------------------------------- | ----------------------------------------------------------------------- |
| `daml/src/Main.daml`             | `Account`, `DAO`, `Proposal` — the whole model                          |
| `daml.js/`                       | Generated bindings — never edit, regenerate with `pnpm daml:codegen`    |
| `src/lib/wallet.ts`              | Phrase → signer closure, encrypted storage, passkey and password unlock |
| `src/lib/session.ts`             | Auto-lock: disposes the signer after 15 quiet minutes or on `pagehide`  |
| `src/lib/wallet-store.svelte.ts` | The wallet as one rune store: onboarding screens, signer, identity      |
| `src/lib/verify.ts`              | Recomputes hashes and inspects transactions before anything is signed   |
| `src/lib/actions.ts`             | What the browser does: call the API, verify, sign, call again           |
| `src/lib/api.remote.ts`          | The server API as remote functions: reads, prepares, execute            |
| `src/lib/server/participant.ts`  | The wallet SDK, wrapped: topology, allocation, ACS, prepare and execute |
| `src/lib/server/app.ts`          | Accounts, DAOs and proposals as the operator sees them                  |
| `src/routes/(app)/`              | My DAOs, DAO, Create DAO, Proposal, Create proposal, Wallet             |
| `src/routes/+page.svelte`        | The landing (v1's Consensus Engine) with `landing.css` and `field.ts`   |
| `src/lib/components/ui/`         | shadcn-svelte components, restyled to the v1 look                       |
| `compose.yaml`                   | The compose project for the servers, Caddy config inline                |

The private key exists only inside a closure (`Signer`): the page can ask it to sign, to encrypt
itself for storage, or to dispose — never to reveal itself. Every write is a transaction the
ledger will only accept with that key's signature, and the backend user is granted no rights on
user parties, so there is no second path. Before signing, `src/lib/verify.ts` decodes what the
server prepared and refuses anything but the asked-for choice, on the asked-for contract of this
package, with the asked-for arguments, acting as the user alone — and at sign-up, a party in the
key's own namespace, held by this key alone, hosted for confirmation only. The server, in turn,
executes only transactions it prepared itself, so its own rules cannot be bypassed.

Reads are open: a DAO is private to the _network_, and this app — as operator — sees all of them,
so listing a party's DAOs takes only the party id. A signed read session is a later iteration.

There is no session and no login. The key is the identity: the server learns which party a key is
by asking the participant (`generate-topology` is a pure function of hint and key), and every
write carries a signature it cannot forge.

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
  returns the ACS already reflects it. (`/execute` alone returns on acceptance and the result lands
  a few seconds later.) It also hardcodes `HASHING_SCHEME_VERSION_V2`, which is what the
  participant returns today.
- `@canton-network/core-tx-visualizer` is the SDK's hashing and decoding, on its own: 168 KB,
  browser-safe, and what `verify.ts` builds on. Its `validateAuthorizedPartyIds` only understands
  create nodes and throws `Unsupported` on an exercise, so the authority check is written by hand
  from the decoded nodes instead.
- The SDK's self-signed token provider logs every JWT it mints at info level. Harmless with the
  validator's dev-mode `unsafe` secret; not something to keep once real auth is in place.
- A package name and version can be uploaded once. A change that is not a valid upgrade (a new
  non-optional field, say) needs a new version — or, as happened here, a package renamed from the
  default `daml` to `syncvotes`. Contract keys would have enforced name uniqueness on-ledger, but
  they need Daml-LF 2.3 and the SDK targets 2.2.
- `dpm codegen-js` emits CommonJS. Vite does not pre-bundle workspace-linked packages by default, so
  `optimizeDeps.include` in `vite.config.ts` is what stops the browser receiving raw CJS.
