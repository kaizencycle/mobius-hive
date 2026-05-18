# Mobius browser shell — HIVE chamber integration

This document connects **mobius-hive** (world JSON in this repo) to **mobius-browser-shell** (human-facing UI) via the playable **HIVE MMO world simulator** artifact.

## Artifact

Static simulator (no build step):

- `artifacts/hive-mmo-simulator/index.html`
- `artifacts/hive-mmo-simulator/simulator.js`

### Local preview (same origin as `/world`)

From the **mobius-hive** repository root:

```bash
npx --yes serve . --listen 8787
```

Open:

- `http://127.0.0.1:8787/artifacts/hive-mmo-simulator/`

The simulator fetches:

- `/world/current-world.json`
- `/world/current-cycle.json`
- `/world/sentinels/{zeus,hermes,jade,atlas}.json`
- Active event/quest files when ids match defaults or are resolvable

If those requests fail (for example `file://` or CORS), the UI falls back to **DEMO DATA** while keeping controls and layout.

### Query parameters

| Param | Purpose |
|--------|--------|
| `shell` | Base URL for **LAUNCH SHELL** (default `https://mobius-browser-shell.vercel.app`) |
| `data` | Optional absolute base URL for world JSON (must end with `/` or path segment for correct join) |
| `demo=1` | Force embedded demo projection (no network) |
| `commits` | Footer label (e.g. commit count string) |

Example with raw GitHub data (public repo, CORS permitting):

```
?data=https://raw.githubusercontent.com/kaizencycle/mobius-hive/main/&shell=https://mobius-browser-shell.vercel.app
```

## Embedding in `HiveLab.tsx`

Recommended patterns:

1. **Iframe (simplest)** — Point `src` at a deployed copy of `artifacts/hive-mmo-simulator/` co-located with published `world/` JSON (same origin), or pass `data` + `shell` query params as above.

2. **Monorepo / static copy** — Copy the two artifact files into the shell’s `public/hive-simulator/` and set `VITE_HIVE_SIM_URL=/hive-simulator/index.html` (or equivalent) for `HiveLab` to render inside the chamber panel.

3. **Portals → shell** — The simulator opens `shell` + `?chamber=<id>`. Wire those query keys in the shell router (or map them to existing tabs/labs). Until routing exists, portals still land on the shell origin for manual navigation.

## Contract alignment

The HUD reads the same fields the shell’s `TopStatusBar` is expected to use:

- `current-world.json`: `cycle`, `integrity.gi`, `vault.progress`, `active_events`, `active_quests`
- Sentinel dialogue: `voice` / `dialogue.default` / `runtime_overlay.voice` from each `world/sentinels/*.json`

The hive repo remains the **canonical write path** for `world/`; the simulator and shell are **read-only consumers**.

## Theming

Visual language: **Midnight Galaxy** — deep indigo/green field, cyan portals, gold accents, `Press Start 2P` (loaded from Google Fonts in `index.html`).
