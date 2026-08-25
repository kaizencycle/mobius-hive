---
epicon_id: EPICON_C-414_CODE_hive-ledger-idempotency_v1
title: "C-414 HIVE citizen-history ledger write idempotency"
cycle: "C-414"
status: "intent"
target_repo: "kaizencycle/mobius-hive"
created_at: "2026-08-25T16:45:00Z"
version: 1
summary: "Stable client operation_id + CPC server deduplication for hive.player_event retries."
paired_dependency: "kaizencycle/Civic-Protocol-Core — same EPICON, operation_id contract"
---

# EPICON C-414 — HIVE Ledger Write Idempotency

## Scope

Repair non-idempotent citizen-history writes when `postPlayerEvent` retries after
ambiguous network failure.

## Paired dependency

**Must merge with:** [Civic-Protocol-Core PR (paired)](https://github.com/kaizencycle/Civic-Protocol-Core) —
`operation_id` on `POST /ledger/attest` for `lab_source=hive` +
`event_type=hive.player_event`.

## Client changes (this repo)

- `lib/hive-player-event.mjs` — canonical `operation_id` derivation
- `artifacts/hive-citadel/public/client.js` — stable body + bounded retry
- `artifacts/hive-world-simulator/operation-id.js` + `game.js` — standalone path
- `tests/hive-player-event-idempotency.test.mjs` — isolated mock CPC fixtures

## Boundaries

- No production CPC or ledger targets in tests
- No deploy, replay, or duplicate cleanup in production
- `mobius-browser-shell` legacy `epicon-attest` path is follow-up (not this PR)

## EPICON-02 INTENT PUBLICATION

```intent
epicon_id: EPICON_C-414_CODE_hive-ledger-idempotency_v1
ledger_id: kaizencycle
scope: code
mode: normal
issued_at: 2026-08-25T16:45:00Z
expires_at: 2026-11-25T16:45:00Z

justification:
  VALUES INVOKED: Operator truth; citizen_history must not duplicate on retry.
  REASONING: postPlayerEvent retried without server dedup could mint duplicate
  hive.player_event records after ambiguous failures. Client now sends stable
  operation_id; CPC deduplicates and returns original outcome on retry.
  ANCHORS:
    - lib/hive-player-event.mjs
    - artifacts/hive-citadel/public/client.js
    - kaizencycle/Civic-Protocol-Core ledger/app/main.py (paired)
  BOUNDARIES: Client + tests only in this repo. No production mutation.
  COUNTERFACTUAL: If retry still creates duplicate events, revert both PRs.

counterfactuals:
  - Same operation_id + same payload → return original event (idempotent: true)
  - Same operation_id + different payload → 409 fail closed
  - Missing operation_id on hive.player_event → 422 at CPC
```
