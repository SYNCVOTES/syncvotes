# syncvotes

A placeholder app for seeing how Daml and TypeScript fit together on Canton. Contract types are
generated from the Daml source; the app runs against its own validator on TestNet at
<https://dev.syncvotes.com>.

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

### Rewards

Nothing touches `Asset` directly. Every action goes through `AppProxy`, whose signatory is the
provider party, which makes the provider a **confirmer** of each transaction. Under CIP-0104
traffic-based rewards go to confirmers; an observer earns nothing. The provider signs the proxy
once, at creation, and takes no part in the user's later transactions. The proxies double as the
app's directory: each carries a name, and listing them is how one user finds another.

## Setup

`daml.js/` is generated and gitignored, so a fresh clone has to produce it before pnpm can resolve
`@daml.js/model`. Codegen first, install second:

```sh
pnpm daml:codegen   # builds the DAR and writes daml.js/
pnpm i
```

## Running it

```sh
pnpm dev            # sandbox + app, output prefixed per service; Ctrl-C stops both
```

Or separately:

```sh
pnpm ledger:start   # Canton sandbox — gRPC on 6865, JSON Ledger API on 6864
pnpm app:dev        # the app on http://localhost:5173
```

The app needs five variables, declared in `src/env.ts` and read at startup so one image can run
against different participants. For the local sandbox:

```sh
LEDGER_API_URL=http://localhost:6864
PROVIDER_PARTY=<a party on the sandbox>
LEDGER_USER_ID=participant_admin
LEDGER_AUTH_AUDIENCE=
LEDGER_AUTH_SECRET=
```

The sandbox does not check tokens, so the audience and secret can be anything.

## How the two languages meet

`daml/src/Main.daml` is the source of truth. `pnpm daml:codegen` compiles it to a DAR and runs
`dpm codegen-js`, which writes TypeScript packages into `daml.js/` — wired in as a pnpm workspace so
`@daml.js/model` resolves like any dependency. Re-run it after every change to the Daml side,
followed by `pnpm i`: codegen wipes `daml.js/` so a stale package can never linger, and that takes
the generated packages' own links with it until pnpm relinks them. `pnpm build` does both for you.

Codegen names its output `@daml.js/<name>-<version>` from `daml/daml.yaml` — neither `-s` nor the
`codegen:` stanza can drop the version from that name. So package.json aliases it once, under
`@daml.js/model`, and everything else uses the alias or a glob. Bumping the version means editing
`daml/daml.yaml` and that one alias line.

`Main.AppProxy.templateId` is `#daml:Main:AppProxy` — the package-name-scoped id the ledger accepts
in commands and ACS filters, which is what keeps a package upgrade from breaking submissions.

## Layout

| Path                            | What it is                                                                |
| ------------------------------- | ------------------------------------------------------------------------- |
| `daml/src/Main.daml`            | `AppProxy`, and the `Asset` template it acts on                           |
| `daml.js/`                      | Generated bindings — never edit, regenerate with `pnpm daml:codegen`      |
| `src/lib/wallet.ts`             | Phrase → signer closure, encrypted storage, passkey and password unlock   |
| `src/lib/session.ts`            | Auto-lock: disposes the signer after 15 quiet minutes or on `pagehide`    |
| `src/lib/verify.ts`             | Recomputes hashes and inspects transactions before anything is signed     |
| `src/lib/actions.ts`            | What the browser does: call the API, verify, sign, call again             |
| `src/lib/api.remote.ts`         | The server API as remote functions: lookup, enrol, list, prepare, execute |
| `src/lib/server/participant.ts` | The wallet SDK, wrapped: topology, allocation, ACS, prepare and execute   |
| `src/lib/server/app.ts`         | Proxies as directory, name registration                                   |
| `deploy/`                       | Compose project and Caddyfile for the TestNet server                      |

The private key exists only inside a closure (`Signer`): the page can ask it to sign, to encrypt
itself for storage, or to dispose — never to reveal itself. Reads are open (a party id is public
anyway); every write is a transaction the ledger will only accept with that key's signature, and
the backend user is granted no rights on user parties, so there is no second path.

There is no session and no login. The key is the identity: the server learns which party a key is
by asking the participant (`generate-topology` is a pure function of hint and key), and every
write carries a signature it cannot forge.

## Deployment

```sh
pnpm deploy
```

That is `docker compose build && up -d` against a Docker context named `syncvotes`: the commands
run here, the server's Docker daemon executes them, and the build context — this working tree,
minus `.dockerignore` — travels over SSH. Nothing lives on the server but Docker and the validator:
no checkout, no runner, no CI. Compose reads `deploy/.env` (see `deploy/.env.example`) locally and
bakes the values into the container's environment; the file itself never leaves this machine.

The server's address is not in the repository. Once per machine:

```sh
docker context create syncvotes --docker host=ssh://<user>@<server>
```

Caddy's config is baked into its image (`deploy/caddy.Dockerfile`) rather than bind-mounted — a
host path would be resolved on the server, where this tree does not exist.

Building on the server is deliberate: it is amd64, the laptop is not, and the layer cache is there.
What gets deployed is the working tree, not a commit — mind what is on disk when running it.

`deploy/` is a separate compose project that joins the Splice validator's network — the validator
has its own `start.sh`, which does more than `compose up`, so a deploy must never recreate its
containers. Caddy binds the public IP because the validator's nginx already holds `:80` on
loopback, and answers to `json-ledger-api.localhost` internally so the participant can be reached
by Host header.

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
- Canton's bootstrap script is not idempotent from 3.5 on: restarting a sandbox with persisted state
  fails with `TOPOLOGY_MAPPING_ALREADY_EXISTS`, and the script is baked into `dpm sandbox`. So the
  local sandbox is a scratch ledger, and the TestNet stand is the environment that matters.

## Building

```sh
pnpm build
node build
```
