# HIVE: The Fogged Citadel — 16-bit world simulator (C-340)

Playable top-down 16-bit simulator of the live HIVE world. Renders the REAL
Mobius substrate state: fetches `world/current-world.json` from this repo's
raw GitHub URL at runtime (CORS-safe), with the C-339 snapshot embedded as
fallback. Fog density = f(GI). Sentinels speak canon dialogue from
`world/sentinels/*.json`. Quest: restore-the-beacon (channel 3 signal nodes).

## Run locally
    cd public && python3 -m http.server
    open http://localhost:8000   (?dev=1 for the FPS overlay)

## Controls
WASD/arrows + Space/E (keyboard, physical key codes), left-half stick +
right-half action (touch), standard mapping (gamepad).

## Architecture
- `public/index.html` — full client: fixed-timestep loop, seeded RNG,
  command-object input, camera, fog-of-integrity, HUD. No frameworks, no CDN.
- `public/strings.js` — ALL player-visible text (localization-ready).
- `public/world-snapshot.js` — embedded C-339 world + sentinel canon + LIVE_URL.
- `logic.js` — Higgsfield apps-engine rules-module stub (solo game).
- `design/assets.csv` — asset manifest (the contract; STYLE FORMULA v1).

## Asset status (honest)
Six of ten manifest rows were generated (Higgsfield nano_banana_2, 16-bit
formula) before a workspace credit wall: tile-stone, tile-court, spr-citizen,
spr-zeus, spr-jade, spr-hermes — job IDs in `public/assets/README.md`,
files to be committed once keyed. Four rows pending credits: spr-beacon,
spr-fountain, card-thumb, card-icon. The client ships formula-palette
procedural fallbacks for every slot, so the game is FULLY PLAYABLE as-is;
generated art drops in with zero code changes (filename contract in
`public/assets/README.md`).

## Deploy path (when credits restored)
Zip {logic.js, index.html, strings.js, world-snapshot.js, assets/} at root →
media_upload → deploy_game (thumbnail+favicon required) → play URL.
