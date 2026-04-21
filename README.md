# Mobius HIVE

Mobius HIVE is the civilization shell of Mobius: a ledger-native social world where identity becomes architecture, contribution becomes terrain, governance becomes ritual space, and memory becomes world state.

## Canon

> If Git City turns contribution into a city, Mobius HIVE turns contribution, governance, memory, and meaning into a civilization.

## Initial structure

- `docs/world/` — spatial world design, district maps, zones
- `docs/game/` — player loops, systems, progression
- `docs/economy/` — token, utility, governance, sinks/sources
- `docs/lore/` — canon, founding myths, houses, rituals

## First artifacts

- district map spec
- player loop diagram
- building progression model
- MVP screen flow

## Mobius Mesh (v1)

This repo participates in the Mobius mesh as a **world node**:

- `mobius.yaml` — declares node identity, ingest sources, scheduled jobs, and governance gates
- `.github/workflows/world-update.yml` — pulls remote mesh inputs and refreshes `world/` + `ledger/hive-world-state.json`
- `.github/workflows/quest-proposal.yml` — generates a proposal artifact and **commits a marker JSON to the default branch** (no ephemeral `cursor/hive-quest-*` PR branches)

Human-facing rendering belongs in `mobius-browser-shell`, which should treat `world/current-cycle.json`, **`world/current-world.json`** (HIVE Sims v1), and friends as read-only inputs.

### C-287 flywheel lock — canonical world artifacts

Committed JSON under `world/` is the **state projection** the browser shell and mesh consumers expect:

| Path | Role |
|------|------|
| `world/current-cycle.json` | Active cycle id, rules fired, signal snapshot, ingest health |
| `world/current-world.json` | **C-290 Sims** — compact mood + integrity + vault summary for UI shells |
| `world/events/<id>.json` | Active world event (e.g. `signal-fog`) |
| `world/quests/<id>.json` | Active quest (e.g. `restore-the-beacon`) |
| `world/sentinels/<id>.json` | Sentinel bios (Sims v1 keeps **ZEUS, JADE, HERMES** on every tick; primary sentinel from rules is highlighted in `current-cycle`) |
| `world/zones/<id>.json` | Zone card data (v1: **Castle**) |
| `ledger/hive-world-state.json` | Ledger-shaped projection of the same tick |
| `ledger/feed.json` | Pulse lane summary for Substrate-style aggregation |

### C-290 — HIVE Sims UI v1 (spec in repo)

- **Schemas:** `schemas/*.schema.json` — validated in CI via `npm run world:validate-schemas` (also runs after each scheduled `world-update` build).
- **Action loop:** `POST /api/hive/action` lives in **mobius-browser-shell** (this repo only ships the **world JSON contract** the shell fetches). Guardrails (OAA log, no MIC mint, no direct canonical edits) are enforced in the shell implementation.

**Browser shell mapping (reference):** `TopStatusBar` ← `current-world.json`; `WorldZoneCard` ← `world/zones/castle.json` + event `ui.overlay`; `SentinelRail` ← `world/sentinels/*.json`; `EventCard` / `QuestTracker` ← `world/events/*`, `world/quests/*`; `ActionRibbon` → `/api/hive/action`.

Ingest order (see `mobius.yaml`): **terminal** `snapshot-lite` (hot lanes), **terminal** `ledger/cycle-state.json` (cycle continuity), **Substrate** `mobius-pulse.json` (mesh MII / pulse envelope), **OAA** latest KV (optional; placeholder URL until the real OAA read surface is wired). Until the terminal serves `ledger/cycle-state.json` at that public path, `ingest_health.cycle_state` may read false while the rest of the tick still succeeds.

### Deterministic CI (fixtures)

Set `HIVE_USE_FIXTURES=1` before `fetch-inputs` to copy `scripts/world/fixtures/*.json` into `ledger/inputs/` instead of calling the network. In Actions, run **World Update → workflow_dispatch** and enable **Use deterministic fixtures** so scheduled runs stay live while manual runs can stay deterministic.

### OAA memory path (browser shell)

Player actions that dual-write sovereign memory should target the **documented** OAA write surface (`/api/oaa/memory` per OAA README). If shell code still points at `/api/oaa/memory/append`, align it there or add a thin alias route — that alignment lives in the shell/OAA repos, not here.
