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
- [x] a client for the gRPC poller behind the WireGuard peer: nothing of this project's talks to
      the participant that way; closed without one (2026-09-23)

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
- [x] `BILLING_FACTOR` stays at one: rewards can only be measured once the provider party is
      featured, which is a MainNet matter; the knob is there for that day (2026-09-23)
- [x] a treasury cannot be rotated in place — moot: there is no treasury party any more
      (2026-09-23)

# 2026-09-22

- [x] stripped back to one admin (the creator), no tokens, no treasury: the balance is paid in
      by memo to the provider from any wallet and credited from the provider's transaction
      history (`syncvotes-board` 0.8.0). Stake votes, locks, the m-of-n treasury and payouts
      live in git history (`bb62260`) if wanted again
- [x] rethink governance from how a real company works (partners, shares, decisions): shares
      of the vote, settings per category, everything by vote — 0.11 through 0.17
- [x] no admin at all: membership, name and dissolution are proposal effects, proposals cannot
      be withdrawn, the balance is anyone's to fill (`syncvotes-meeting` 0.9.0)
- [x] a decision rule per proposal (all vs cast, majority vs percent, quorum, early settle), presets
      after v1 and DAO DAO (`syncvotes-rules` 0.10.0)
- [x] shares of the vote: a table at the founding, moved only by a share proposal; ballots weigh
      shares; a share changed mid-vote casts no ballot (`syncvotes-shares` 0.11.0)
- [x] the treasury back, as a party of the DAO's own that the app acts for: anyone pays in to its
      address, traffic is collected from it, payouts and the remainder on dissolution leave it
      by vote; shares in whole units, DAOs by membership or by shares, share changes carried out
      in batches (up to 2000 per proposal); votes that may change until the deadline (never with
      early settlement); Markdown with pictures by link; comments; profiles
      (`syncvotes-treasury` 0.12.0)
- [x] the treasury gone again, payouts with it: a DAO holds no coin; its balance is paid in
      by memo to the provider from any wallet, read off the provider's transactions, credited to
      the meter; dissolution archives the DAO at once; no `paid.json`, no state off the ledger
      (`syncvotes-books` 0.17). The treasury party, payouts and the remainder are in git
      history at `9d8a00b`, audited four rounds, if a DAO ever needs to hold coin
- [x] a treasury the provider cannot touch (m-of-n signers by vote) — not wanted: a DAO holds
      no coin now; `bb62260` keeps the working pieces should that change (2026-09-23)
- [x] the DAO's settings, set at the founding and changed only by vote: for routine and for
      sensitive proposals, the rule and the voting period; a proposer chooses what, never what it
      takes (`syncvotes-rulebook` 0.14.0, after a one-rule step `syncvotes-bylaws` 0.13.x with
      "ask for more"). Settings read as a list with a preset to start from; hints on every
      option; rules say what they come to in this DAO's numbers
- [x] audit round 1 (`tmp/audit-1.md`) → creator co-signs member/proposal/ballot/comment with
      cross-checks; Fraction thresholds; two-step dissolution; backoff and "stuck" reasons; final
      count after a grace; refused ballots isolated; collection meter-first; paced comments;
      payouts only to addresses outside the app (`syncvotes-minutes` 0.15.0)
- [x] audit round 2 (`tmp/audit-2.md`) → ballot on record only, one step of dissolution at a time,
      counts that wait out the network, payouts taken back by instruction, receivers outside the
      app and known to the network (`syncvotes-register` 0.16.0)
- [x] audit round 3 (`tmp/audit-3.md`) → one command id per payment (duplicates count as sent),
      remainder waits to land, write-offs against balance, sign-up paced per visitor, failed
      share changes unblock their parties
- [x] audit round 4 (`tmp/audit-4.md`) → the participant's error code reaches the message, so
      a resent payment that went is seen as a duplicate; a refusal is told from a lost reply
      (nothing went vs. resend under the same id); the attempt number survives `sending`;
      collection keyed on what was collected before; locks left alone while their instruction
      stands. The logic audit stops here; what it left is below
- [x] the client's address is Caddy's to work out: Cloudflare's ranges are the trusted proxies,
      `X-Client-Ip` is what the app reads; a made-up header on a direct hit counts for nothing
- [x] Daml Script tests — written (decoy ballot, late ballot, invented member, dissolution,
      refused settings), then removed at the user's word: the e2e runs against TestNet are the
      tests (2026-09-23)
- [x] no more renames: `syncvotes-options` is the lineage, every release an SCU of the one
      before, gated by `upgrades:`; a key whose Account is on an old lineage gets its party
      back by fingerprint (its DAOs are not carried over) (2026-09-23)
- [x] a choice among options: `Choose` proposals, two to ten options, a ballot picks one; the
      leader is measured as a yes would be, a tie fails (`syncvotes-options` 0.20.0)
- [x] `Comment_Remove` — not wanted: a member who may propose may comment, and nobody moderates
      a DAO run by nobody; a comment is its author's alone (built, then taken out the same
      day; removing a choice is no upgrade, so the package is `syncvotes-quorum` 0.18.0).
      Proposals paced like comments (thirty writes an hour). Then editing and deleting one's
      own comments went too: a comment is on the record, like a ballot (`syncvotes-record`
      0.19.0)
- [x] the provider's pre-approval is renewed twenty days before it runs out, checked daily
- [x] `ParticipantAdmin` on the web process stays: allocating a party at sign-up needs the same
      right the DAR upload does, and sign-up is the web process's job; a setup job would move
      the upload and leave the right where it is (2026-09-23)
- [x] every user party has one confirming participant: the wallet page says so
