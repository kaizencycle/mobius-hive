# HIVE — 16-bit World Simulator (C-344 artifact)

A self-contained **16-bit, top-down JRPG-style world simulator** of the Mobius
HIVE civilization. You play a **Scout** who lifts the **Signal Fog** of cycle
**C-344** by walking the realms, sweeping their **integrity shards**, and
lighting each realm's **beacon**. Seal every realm and the central **Fountain**
unlocks — *Restore the Beacon* to seal the cycle.

It maps the Proof-of-Cycle loop directly onto play: **Seed → Sweep → Seal →
Ledger** (talk to a realm keeper → collect shards → light the beacon → seal the
cycle at the Forge).

## Grounded in live world state

The world is built from the repo's canonical contracts:

- realms, keepers and connections — `world/realms.json`
- cycle / event / quest / integrity — `world/current-world.json`, `world/current-cycle.json`,
  `world/events/signal-fog.json`, `world/quests/restore-the-beacon.json`
- sentinel voices (ZEUS, JADE, HERMES, ATLAS, AUREA) — `world/sentinels/*.json`

A frozen projection lives in `world-snapshot.js` so the deployed build is fully
self-contained. When served from the repo root (`npx serve .` then open
`/artifacts/hive-world-simulator/`) or launched with `?data=<base>`, it overlays
the **live** `world/current-world.json` and the HUD flips from `SNAPSHOT` to
`LIVE`.

## Controls

- **Move:** Arrow keys / WASD · on-screen D-pad (touch) · gamepad stick or D-pad
- **Talk / Act:** `E` / `Space` / `Enter` · `A` button (touch / gamepad)
- **Close:** `Esc`
- Debug overlay: append `?dev=1`.

## Run locally

```bash
cd artifacts/hive-world-simulator
python3 -m http.server 8000   # ES modules need http://, not file://
# open http://localhost:8000/
```

## Assets

All 16-bit art is crisp pixel art under `assets/`, regenerable with
`python3 tools/gen_assets.py`. Every asset embeds one shared **STYLE FORMULA**
(see `design/assets.csv`). The art was authored procedurally because the
Higgsfield image-generation credits were unavailable at build time; the manifest
rows can be swapped for AI-generated sprites of the same kinds with no code
changes.

## Deploy

Packaged at the archive root as `index.html` + `logic.js` (single-player engine
stub) + `game.js` + supporting modules + `assets/`, then published via the
Higgsfield apps engine (`deploy_game`).
