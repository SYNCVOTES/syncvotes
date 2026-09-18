# Plan: treasuries, stake-weighted votes, DAOs as components

Written 2026-09-17. Facts below are from docs.canton.network and our own measurements; items
marked _measure_ are unverified and get a one-day spike before anything is built on them.

## What Canton fixes for us

- **Traffic is paid per validator, not per party.** The sending validator burns CC for every
  MB it submits (`extraTrafficPrice`, USD/MB, plus a free regenerating burst). Our users are
  hosted on our validator, so today every DAO transaction is paid by us. "The organisation
  pays for its transactions" therefore means: it reimburses our traffic.
- **Rewards are traffic-based** (CIP-0104, measured on DevNet and TestNet): the provider
  party earns `RewardCouponV2` in proportion to the traffic of transactions it confirms — it is
  a signatory of every contract we write, so every DAO transaction earns. The subsidy is
  exactly `rewards / burned` over a period, and the coefficient the organisation pays is
  `k = 1 - rewards / burned`. Neither number is known for MainNet until we are featured there.
- **The cost of a transaction is known before it is signed.** Prepare returns the serialised
  transaction; its size × price × k is the charge. That is the same size we already optimise.
- **A party may have several signing keys with a threshold.** A treasury owned by m-of-n
  admins is native, no custom multisig contract. Execute takes several signatures per party
  (`partySignatures[].signatures[]`). _Measure:_ how long a prepared transaction stays
  executable (contract ids are pinned; ledger-time tolerance) — this bounds how signatures
  can be collected.
- **Token-standard holdings can be locked** (`Holding.lock = { holders, expiresAt,
expiresAfter, context }`). A locked holding stays in the owner's wallet; the lock holders
  can only refuse an early unlock, never spend. That is stake without custody.

## 1. Operational treasury: who pays for transactions

**Model: a prepaid credit per DAO, held with the provider.** No extra party, no extra
signature per transaction.

- Top-up: anyone sends CC to the provider party with the DAO id as the transfer reference.
  The provider party carries a transfer pre-approval so incoming transfers settle without
  anyone accepting them. The server sees the transfer in its feed and credits the DAO.
- Charge: at prepare, `size_bytes × extraTrafficPrice × k`, shown next to the sign button.
  Debited in the server's index, not on the ledger — a ledger write per transaction would
  double the traffic it accounts for.
- Evidence: one small `Meter { dao, provider, credited, charged, asOf }` contract per DAO,
  replaced by the provider once a day or when a threshold moves. Admins see it; it is the
  statement. Constant size.
- Empty balance: the server refuses to prepare writes for that DAO; reads stay free. A
  configurable grace amount covers the validator's own free burst.
- `k`: 1.0 at launch. After a period with real rewards: `k = 1 - coupons / burned`, both
  read from our validator (coupon contracts, traffic purchases). Recomputed monthly, shown
  in the DAO's billing panel with the numbers behind it.
- Price source: `extraTrafficPrice` and the CC/USD rate from Scan, cached.

Rejected: a DAO-owned party that pays its own traffic. Traffic cannot be attributed to a
party on Canton, so it would only add a party and a signature and change nothing.

## 2. Stake and voting power

**Stake = a locked holding in the member's own wallet.** Funds never move.

- The member locks `amount` of the DAO's instrument (CC by default; any token-standard
  instrument later) with `holders = [provider]`, `expiresAt = now + lock period`. The lock
  period is a DAO setting (30 days to start). Before expiry the owner cannot unlock alone;
  after it, the owner unlocks alone. The provider can never spend it.
- On-ledger record: `Stake { dao, member, provider, holding, amount, until }`, created by the
  member's signature. The choice fetches the holding through the `Holding` interface and
  checks owner, lock holders, `expiresAt`, amount — the provider cannot forge a stake.
- Weight: a proposal counts only stakes whose `until ≥ closesAt`. Opening becomes a batched
  `Proposal_Weigh { stakes }` (like the tally: fixed batches, each stake fetched and checked
  on ledger) that sums `eligible`; `Member_Vote` takes the member's `Stake` and the ballot
  carries its amount. Counters become `Decimal`. Pass rule: `yes > eligible / 2` by default,
  quorum configurable per DAO.
- Re-staking: a new lock replaces the `Stake` (one contract per member per DAO, constant
  size). Unstaking = let the lock expire, or ask the provider to release early if no
  proposal counts it (a choice the member exercises, the provider co-signs automatically).
- _Measure:_ creating a locked CC holding from the browser flow. Amulet's
  `AmuletRules_Transfer` supports locked outputs; the wallet SDK may not expose it, in which
  case the server prepares the raw exercise with the disclosed `AmuletRules` and
  `OpenMiningRound` contracts and the member signs it like any other transaction.

Rejected: counting unlocked balances at a snapshot (a member with two parties counts twice;
nothing on ledger proves the weight), and pooling stake in a DAO party (custody).

## 3. Governed treasury: DAO money, spent by vote

**Model: an external party whose keys are the treasury signers, threshold m-of-n.**

- Created with a DAO component `Treasury { dao, party, signers, threshold }`. Signers are
  admins to start; a later component can make them an elected council.
- Funding: anyone transfers to the treasury party (pre-approval set once, signed m-of-n).
- Spending: a `Payout { to, amount, instrument }` proposal. When it passes, the server
  prepares the transfer, the signers sign in the app (each sees the same intent check the
  browser does today), the server executes once `m` signatures are in. On-ledger evidence
  is the passed proposal; the browser refuses to sign a transfer that does not match it.
- _Measure first:_ multi-key external party allocation (topology with several keys and a
  threshold — our `verify.ts` already reads that field), executing with several
  signatures, and the prepare→execute window. If the window is minutes, signing is a live
  session ("3 of 5 signers online") and an expired preparation is simply re-prepared with
  the same intent and a new hash; the UI shows a queue of payouts awaiting signature.

Fallback if the spike fails: the treasury key held by the provider and the server refusing
any transfer without a passed proposal. Same trust as the count today, stated plainly in
the DAO's treasury panel. Not the goal.

Separate later component, "Funding": a one-off collection using token-standard
`Allocation` — members allocate to a specific payment, the provider as executor can only
execute or cancel it, money stays in wallets until execution. Trustless, no treasury needed.

## 4. DAOs and proposals as components

- **DAO core** stays what it is: name, description, membership. Every component is its own
  small contract keyed by the DAO id with the same signatories (admin + provider):
  `Billing`, `Staking`, `Treasury`, later `Council`, `Timelock`, … No component touches the
  DAO contract, so adding one is one small transaction and nothing accumulates.
- **Voting module** is a DAO setting: `Membership` (one member, one vote — today) or
  `Stake`. Counters are `Decimal` in both; `Membership` weights are 1.
- **Proposal = core + action.** `action : Signal | Payout {…} | Members { add, remove } |
Config { … }`. `Signal` is today's proposal. When a proposal with an action reaches
  `Passed`, the provider exercises `Proposal_Execute`; Daml fetches the proposal, asserts the
  outcome and performs the action with the DAO's authority (the DAO choices take a passed
  proposal as their evidence, so the provider cannot execute anything a vote did not pass).
  `Members` lets a DAO govern its own membership instead of trusting the admin. `Payout`
  produces a `PayoutDue` the treasury signers settle (section 3).
- **Code layout:** one folder per component with its Daml template, its slice of the
  server index, its remote functions and its UI panel; the DAO page renders the panels of
  the components the DAO has, the propose page offers the actions they enable. Creating a
  DAO is "base + toggles".
- Later components, in the DAO DAO spirit: veto/council, timelock before execution,
  multiple-choice votes, delegation, sub-DAOs, own token (needs a token-standard registry
  implementation — large, last).

## Order of work

1. **Billing** (section 1): pre-approval on the provider party, credit from incoming
   transfers, cost at prepare, daily `Meter`, `k = 1`. Measure our burn against coupons on
   TestNet for a week to see the shape of `k`.
2. **Components refactor** (section 4): `action` on proposals, `Proposal_Execute`,
   `Members` action, component contracts, folder layout, DAO create wizard. New package
   name (incompatible template change).
3. **Stake** (section 2): lock spike, `Stake`, `Proposal_Weigh`, `Decimal` counters,
   stake-weighted e2e and scale run (a DAO with 100+ stakers).
4. **Treasury** (section 3): multi-key party spike, `Treasury` component, `Payout` action
   and signing queue.

Each step ships behind its own package version, with e2e and a scale run before deploy.

## Open decisions

- Instrument for stake: CC only at first, or configurable from day one?
- Treasury signers: admins, or a separately elected council from the start?
- Lock period and whether a member may re-lock while a vote counts their stake.
- Billing grace: refuse at zero, or allow a small negative balance and nag?
