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

- `lib/hive-player-event.mjs` — crypto-random `operation_id` + session cache
- `artifacts/hive-citadel/public/client.js` — stable body + bounded retry
- `artifacts/hive-citadel/public/operation-id.js` — localStorage + session fallback
- `artifacts/hive-world-simulator/operation-id.js` + `game.js` — standalone path
  (seal uses `extra.realm` as `targetId` so each realm gets a distinct operation_id)
- `tests/hive-player-event-idempotency.test.mjs` — isolated mock CPC fixtures

## Boundaries

- No production CPC or ledger targets in tests
- No deploy, replay, or duplicate cleanup in production
- `mobius-browser-shell` legacy `epicon-attest` path is follow-up (not this PR)

## EPICON-02 INTENT PUBLICATION

```intent
epicon_id: EPICON_C-414_CODE_hive-ledger-idempotency_v1
ledger_id: mobius:kaizencycle
scope: infra
mode: normal
issued_at: 2026-08-25T16:45:00Z
expires_at: 2026-11-25T16:45:00Z
justification:
  VALUES INVOKED: Operator truth; citizen_history must not duplicate on retry.
  REASONING: postPlayerEvent retried without server dedup could mint duplicate hive.player_event records after ambiguous failures. Client now emits crypto-random hive-op IDs persisted in localStorage with an in-memory session fallback when storage throws; CPC deduplicates on (civic_id, operation_id) and returns the original outcome on retry. Seal events map extra.realm into targetId so each realm gets a distinct operation_id.
  ANCHORS:
    - lib/hive-player-event.mjs
    - artifacts/hive-citadel/public/operation-id.js
    - artifacts/hive-citadel/public/client.js
    - artifacts/hive-world-simulator/operation-id.js
    - artifacts/hive-world-simulator/game.js
    - docs/epicon/cycles/C-414/EPICON_C-414_CODE_hive-ledger-idempotency_v1.md
    - kaizencycle/Civic-Protocol-Core ledger/app/main.py (paired PR #105)
  BOUNDARIES: Client + tests only in this repo. No production replay, duplicate cleanup, or mobius-browser-shell epicon-attest path (follow-up).
  COUNTERFACTUAL: If retry still creates duplicate events or storage failure mints new IDs per retry, revert both paired PRs immediately.
counterfactuals:
  - Same operation_id + same payload → return original event (idempotent: true)
  - Same operation_id + different payload → 409 fail closed
  - Missing operation_id on hive.player_event → 422 at CPC
  - localStorage unavailable → session cache keeps operation_id stable for page-load retries
  - Multiple realm seals in one cycle → distinct operation_id per realm via targetId
```
