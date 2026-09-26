# SyncVotes

DAOs, proposals and votes on the Canton Network, signed by keys only their members hold. Live on
<https://syncvotes.com> (MainNet), <https://test.syncvotes.com> (TestNet) and
<https://dev.syncvotes.com> (DevNet). How to use it, the voting rules and the trust model are in
the docs at [syncvotes.com/docs](https://syncvotes.com/docs).

## How it works

- **Keys and parties.** Each user is an
  [external party](https://docs.canton.network/overview/reference/external-party) hosted on the
  app's validator. The key comes from a 12-word phrase and never leaves the browser. The server
  prepares each transaction; the browser decodes it, checks it is what the page asked for, and
  signs.
- **The model.** A Daml package, `syncvotes`, in `daml/src/SyncVotes/`. The app's own party, the
  provider, co-signs every contract, counts the ballots and carries out what passed. The ledger
  checks every ballot and every change it is handed.
- **Money.** Everything costs network traffic. Users and DAOs pay in by sending Canton Coin to the
  validator's party with a memo (`syncvotes:<dao id>` or `syncvotes:<key fingerprint>`); each
  transaction is charged its traffic, net of the rewards it earns back. SyncVotes is a featured
  app, and its activity markers and app rewards pay back part of that traffic.
- **Privacy.** Whoever runs the validator can read every DAO it hosts, private ones and secret
  ballots included. A community that must keep its DAOs to itself runs SyncVotes on its own
  validator, as below.

## Run your own

### What you need

- A [Splice validator](https://docs.canton.network) on the network you want, onboarded, with coin
  to buy traffic, run by its own `start.sh` on a Linux server with Docker.
- A domain for the site, pointed at that server. Cloudflare in front is supported and advised.
- On your machine: this repository, Docker, and a Docker context for the server:

  ```sh
  docker context create syncvotes-mainnet --docker host=ssh://<user>@<server>
  ```

  The image is built on the server; nothing but Docker and the validator lives there.

### Steps

1. **Settings.** Copy `.env.example` to `<network>.env` (`mainnet.env`, `testnet.env` or
   `devnet.env`) and fill it in; every setting is in the table below. Use long random values
   for every secret. The env files are ignored by git and never leave your machine. Compose
   insists on `PROVIDER_PARTY`, which step 3 prints: until then set it to `pending`.

2. **Sign-in for the ledger.** The app, its backend and the validator trust one Keycloak realm,
   `canton`, which this compose project runs and serves under `/auth` on your domain. Start it
   first:

   ```sh
   docker --context syncvotes-<network> compose --env-file <network>.env up -d keycloak caddy
   ```

   Then point the validator's own `.env` at it (`AUTH_URL`, `AUTH_JWKS_URL`,
   `AUTH_WELLKNOWN_URL` = `https://<domain>/auth/realms/canton…`, the audiences and client ids
   from your env file), pin `PARTICIPANT_DB_NAME` there, and restart the validator with
   `start.sh … -a`.

3. **The app's party and ledger user.** Once per validator:

   ```sh
   VALIDATOR_CLIENT_SECRET=$(grep ^KC_VALIDATOR_SECRET= <network>.env | cut -d= -f2-) \
     docker --context syncvotes-<network> compose --env-file <network>.env run --rm --no-deps \
     -e VALIDATOR_CLIENT_SECRET app node scripts/setup-participant.mjs
   ```

   It allocates the provider party `syncvotes-app-provider` and gives the app's ledger user
   `ParticipantAdmin`, `CanReadAsAnyParty`, `CanExecuteAsAnyParty` and `CanActAs` the provider,
   and never the right to act as a user. Put the party it prints in `PROVIDER_PARTY`, and the
   validator's own party in `PAYEE_PARTY`.

4. **Start.**

   ```sh
   pnpm deploy:<network>
   ```

   That is `compose build` and `up -d` against the context, from a clean git tree only; the
   commit is baked in. At startup the app uploads its Daml package and reads the ledger.
   `https://<domain>/version` then answers with the commit and the package id.

5. **Check.** The app log says `Daml package … is on the participant`. Make sure the participant
   has also vetted it: `POST /v2/package-vetting` on the ledger API lists `syncvotes` with the
   version you deployed. An upload can succeed and still not be vetted, for example next to an
   older, incompatible package of the same name.

6. **Who pays.** For a community of your own, `BILLING_FACTOR=0` makes every transaction free to
   members and lets the validator pay. `INVITE_CODES` keeps sign-up to your people.

### Proxies

By default Caddy binds `PUBLIC_IP:80/443` and gets its own certificates. Where another proxy
already holds those ports:

- **nginx on the host:** `CADDY_HTTP_BIND=127.0.0.1:8085`, `CADDY_SITE=http://<domain>`,
  `CADDY_TRUSTED_EXTRA=127.0.0.0/8`, and an nginx site that terminates TLS and forwards to
  `127.0.0.1:8085`. Give it `proxy_buffer_size 32k` (and `proxy_buffers 8 32k`): the app's
  headers pass nginx's default 4 KB on some pages, and nginx answers 502.
- **traefik:** the same binds, plus `TRAEFIK=true`, `PROXY_NETWORK=<traefik's network>`,
  `PROXY_NETWORK_EXTERNAL=true`, `CADDY_TRUSTED_EXTRA=private_ranges`. Compose sets the router
  labels, including an allow-list of Cloudflare's ranges.

Behind Cloudflare, let only Cloudflare reach the server: `CADDY_ALLOWED_PEERS` where Caddy faces
the internet, the traefik allow-list above, or a `geo` on `$realip_remote_addr` in nginx. Caddy
reads the visitor's address from Cloudflare's headers and passes the app `X-Client-Ip`, which
rate limits use.

Caddy's config is inline in `compose.yaml`; after changing it, run
`compose up -d --force-recreate caddy`. Keycloak's admin console, its master realm and the
account console are not served publicly: reach them over an SSH tunnel to `keycloak:8080`, as
`KC_ADMIN_NAME`.

### Settings

| Setting                                                                    | What it is                                                                                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `APP_DOMAIN`                                                               | The site's domain.                                                                                                        |
| `PUBLIC_IP`                                                                | The address Caddy binds to when it has ports 80 and 443 itself.                                                           |
| `NETWORK`                                                                  | `MainNet`, `TestNet` or `DevNet`: shown to users.                                                                         |
| `NETWORKS`                                                                 | The sites the network switcher offers: `Name=https://url,…`, this one included.                                           |
| `SCAN_URL`                                                                 | The network's public Scan: coin rules, rounds, prices, featured apps.                                                     |
| `VALIDATOR_NETWORK`                                                        | The validator's Docker network, which the app joins. Default `splice-validator_default`.                                  |
| `WALLET_USER_NAME`                                                         | The validator operator's wallet login; equals the validator's `PARTY_HINT`.                                               |
| `PROVIDER_PARTY`                                                           | The app's party, printed by `setup-participant.mjs`.                                                                      |
| `PAYEE_PARTY`                                                              | Where users pay in: the validator's own party, whose wallet buys traffic. Empty means the provider.                       |
| `DEPOSITS_SINCE`                                                           | ISO time from which memo payments count. Set it when accounts start afresh.                                               |
| `BILLING_FACTOR`                                                           | What users pay, as a multiple of the traffic's net cost: `1` covers it, below 1 the validator subsidises, `0` is free.    |
| `BILLING_FLOOR`                                                            | The least charged, as a fraction of the network's traffic price, even when rewards cover everything. `0` is no floor.     |
| `MARKERS`                                                                  | `true` records featured-app activity markers, when the provider holds a featured app right.                               |
| `INVITE_CODES`                                                             | Comma-separated codes needed to sign up. Empty is open sign-up.                                                           |
| `LEDGER_API_AUDIENCE`, `VALIDATOR_AUDIENCE`                                | Token audiences of the participant's ledger API and the validator's API.                                                  |
| `WALLET_UI_URL`, `CNS_UI_URL`                                              | Where the validator's own wallet and name-service UIs live, for their login clients.                                      |
| `KC_ADMIN_NAME`, `KC_ADMIN_PASSWORD`                                       | Keycloak's administrator.                                                                                                 |
| `KC_DB_PASSWORD`                                                           | Keycloak's database.                                                                                                      |
| `KC_APP_SECRET`, `KC_VALIDATOR_SECRET`                                     | Client secrets of the app and of the validator backend.                                                                   |
| `KC_APP_USER_ID`, `KC_VALIDATOR_USER_ID`, `KC_WALLET_USER_ID`              | Fixed ids of the realm's users, which become ledger user names.                                                           |
| `KC_WALLET_USER_PASSWORD`                                                  | The validator operator's wallet login password.                                                                           |
| `CADDY_HTTP_BIND`, `CADDY_HTTPS_BIND`, `CADDY_SITE`, `CADDY_TRUSTED_EXTRA` | Behind another proxy (see Proxies).                                                                                       |
| `TRAEFIK`, `PROXY_NETWORK`, `PROXY_NETWORK_EXTERNAL`                       | Behind traefik.                                                                                                           |
| `CADDY_ALLOWED_PEERS`                                                      | Where Caddy faces the internet: the only peers it serves, e.g. `private_ranges` and Cloudflare's ranges. Empty is anyone. |

## Updating

`pnpm deploy:<network>` again. Nothing goes down: Caddy holds requests until the new app answers.

The Daml package keeps its name, `syncvotes`, for good: renaming it would hide every existing DAO.
Each release is a Smart Contract Upgrade of the one before, checked by the compiler:

1. Bump `version` in `daml/daml.yaml`.
2. Point `upgrades:` at the previous DAR and keep that DAR in `daml/upgrades/`.
3. Update the `@daml.js/model` alias in `package.json` to the new version.

An upgrade may change a choice's body, add templates and choices, and add `Optional` fields at the
end. It may not remove or retype fields or choices, move a template to another module, or change
signatories and observers. After deploying, check the vetting on every network (step 5).

## Development

There is no local ledger; what runs locally is the type-checker, the linter and the build.
Building the DAR needs `dpm`, which is x86-64 only (Rosetta on Apple silicon).

```sh
pnpm daml:codegen   # builds the DAR and writes the bindings to daml.js/
pnpm i
pnpm check
pnpm lint
pnpm exec vite build
```

Run codegen and `pnpm i` again after every change to the Daml side.
