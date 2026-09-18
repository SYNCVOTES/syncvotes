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
- [x] token standard + treasury — every party gets a pre-approval at sign-up; the treasury is a
      multi-key party with one from the validator's setup proposal (2026-09-18)

# 2026-09-15

- [x] real auth: Keycloak realm under /auth, RS256 everywhere, validator restarted with `-a`;
      the app's ledger user is a service account with participant-wide read/execute rights and no
      `CanActAs` on user parties. Measured: `prepare` needs read rights on the acting party
- [ ] a client for the gRPC poller behind the WireGuard peer, if it still talks to the participant

- [x] edit and delete DAOs and proposals (Daml 0.1.4: DAO_Update/Archive, Proposal_Update/Cancel,
      stable DAO id, admin copied into proposals); several keys per device; DAO page and footer as
      in v1; lucide icons; copyable party ids; landing on Tailwind with what-it-is and
      under-the-hood sections; contrast raised in its own commit
- [x] billing agent dropped — not needed; its Keycloak client and variables removed
- [x] read sessions: a DAO is readable by its members only (signed challenge per unlock, HttpOnly
      cookie, in-memory sessions); WebAuthn errors in plain words; edit pages wait for data
- [x] pages composed from components (components/ui = shadcn primitives, components/ = everything
      built on them, landing-* for the landing); SyncVotes favicon (SVG + PNG), the template's
      Svelte favicon link removed from the root layout
- [x] second review round (UI/UX + edge cases, browser-tested): close after deadline, directory
      behind a session, session recovery, error pages, trim-before-sign, overflow, name preview,
      forget confirm, propose gate, period check
- [x] text forms are SvelteKit remote forms with per-field validation (lib/schemas.ts, preflight
      in the browser, re-check on the server, then sign); members as chips again; dead code and
      the single-key migration removed; auto-lock and hint modules named for what they are

# 2026-09-16

- [x] simpler model (`syncvotes-vote` 0.3.0): no VoteRight, no CountedBallot — a member votes
      from their own Member contract, which remembers the proposal; the DAO counts its members
      and `Proposal_Open` fixes the electorate in one transaction; the count checks every ballot
      it takes (DAO, proposal, deadline, member since before opening)
- [x] server: index.ts + feed.ts → ledger.ts (one removal closure per contract, keyed
      wake-ups), app.ts folded into the remote functions, prepares take ids and the session
      party, `execute` waits for the ledger copy; remote forms verified against the submitted
      fields, not the server's reply; wallet store with one `lock()` and one `protect()`
- [x] measured (scale.mjs, 221 members): add 220 members 13 s in two batches, create + open 13 s,
      40 parallel voters 45 s with 0 failures, count within 3 s (121 members: 9 s, 9 s, 42 s)
- [x] a member's contract no longer grows with history: it keeps only votes whose deadline has
      not passed (Daml syncvotes-consensus 0.5.0); Abstain added as a third choice
- [x] no proposal editing and no draft state: a proposal opens as the provider sees it; to
      change one, cancel and propose again

# 2026-09-18

- [x] admins (several; at creation, by an admin, by a vote), proposal effects carried out by the
      ledger, stake votes on coin locked in the wallet, a treasury owned by the admins' keys
      (m of n) with signing sessions, billing at the traffic the participant reports
      (`syncvotes-charter` 0.7.0; e2e council/stake/scale green on TestNet)
- [ ] `BILLING_FACTOR`: measure rewards against traffic once the provider party is featured on
      the network it runs on (it is not on TestNet), then set it below one
- [ ] a treasury cannot be rotated in place (the network allows no second topology serial via
      the JSON API); today the admins rebuild it and move the coin — an admin API path may
      allow rotation later
- [ ] the gRPC poller behind the WireGuard peer, if it still talks to the participant
