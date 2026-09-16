# 2026-09-02

- [x] fix ledger:init (dropped — wallet logs in as `participant_admin`, no provisioning step)
- [x] read docs on wallet gateway
- [x] make sandbox persistant — отказались: bootstrap Canton 3.5 не идемпотентен, LocalNet не влезает в 16 ГБ
- [x] fix wallet:start
- [x] check if anything can be improved or simplified
- [x] fix daml package version being everywhere (only in daml/daml.yaml and package.json workspace alias now)
- [x] tackle scripts question

# 2026-09-04

- [x] deploy on testnet — https://dev.syncvotes.com

# 2026-09-11

- [x] key in the browser: recovery phrase → ed25519 → external party hosted on our validator,
      every transaction signed client-side; passkey (PRF) or password lock; API as remote functions
- [x] server side on @canton-network/wallet-sdk (topology, allocate, ACS, prepare, executeAndWait)
- [x] browser verifies what it signs (hash recomputed, choice/template/actAs checked) — tamper test passes
- [x] deploy = `pnpm deploy`: compose over `DOCKER_HOST=ssh://`, build on the server's daemon from
      the local tree; the app uploads its own DAR at startup. GitHub Actions + runner removed
- [ ] token standard + treasury — users fund their app party from any wallet (CC transfers work
      across validators), payments to the treasury are party-to-party on our validator.
      Treasury party needs a transfer pre-approval (`sdk.amulet.preapproval`) or every incoming
      payment sits as a pending instruction until someone accepts it

# 2026-09-15

- [x] real auth: Keycloak realm under /auth, RS256 everywhere, validator restarted with `-a`;
      the app's ledger user is a service account with participant-wide read/execute rights and no
      `CanActAs` on user parties. Measured: `prepare` needs read rights on the acting party
- [ ] clients for everything else that talked to the participant unauthenticated (billing agent,
      the gRPC poller behind the WireGuard peer)

- [x] edit and delete DAOs and proposals (Daml 0.1.4: DAO_Update/Archive, Proposal_Update/Cancel,
      stable DAO id, admin copied into proposals); several keys per device; DAO page and footer as
      in v1; lucide icons; copyable party ids; landing on Tailwind with what-it-is and
      under-the-hood sections; contrast raised in its own commit
- [ ] the billing agent's auth model (one Keycloak client per wallet user, or one service account
      acting for the treasury only) — the user's call, script lives outside the repo
- [x] read sessions: a DAO is readable by its members only (signed challenge per unlock, HttpOnly
      cookie, in-memory sessions); WebAuthn errors in plain words; edit pages wait for data
- [x] pages composed from components (components/ui = shadcn primitives, components/ = everything
      built on them, landing-* for the landing); SyncVotes favicon (SVG + PNG), the template's
      Svelte favicon link removed from the root layout
- [x] second review round (UI/UX + edge cases, browser-tested): close after deadline, directory
      behind a session, session recovery, error pages, trim-before-sign, overflow, name preview,
      forget confirm, propose gate, period check
- [ ] names are unique only app-side (no contract keys on LF 2.2): two simultaneous registrations
      of one name can both land
