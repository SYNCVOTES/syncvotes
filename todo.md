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
- [x] GitHub self-hosted runner on <server> (systemd service, label `syncvotes`); a push to
      main deploys. Secrets live in ~/syncvotes-deploy.env on the server, outside the checkout
- [ ] token standard + treasury — users fund their app party from any wallet (CC transfers work
      across validators), payments to the treasury are party-to-party on our validator.
      Treasury party needs a transfer pre-approval (`sdk.amulet.preapproval`) or every incoming
      payment sits as a pending instruction until someone accepts it
