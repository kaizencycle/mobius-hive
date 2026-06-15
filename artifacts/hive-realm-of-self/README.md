# HIVE: Realm of Self — tilemap town (C-343)

First tilemap-driven HIVE zone, replacing the procedural-rectangle renderer
from HIVE Citadel (C-340/341) with a real Tiled (.tmj) map.

## Run
    cd public && python3 -m http.server
    open http://localhost:8000   (?dev=1 for FPS overlay)

## What changed vs hive-citadel
- `tilemap.js` — generic Tiled JSON loader: parses tilesets, CSV tile
  layers, and object groups (exits/spawn/signal_node) into a render+collide
  API. Reusable for every future zone.
- `assets/tileset.png` — 128x128 procedural 16x16 tileset (8x8 grid, Kenney
  "Micro Roguelike" grid convention: 16px tiles, 8 columns). Tiles: stone
  floor (x2), courtyard, grass, water, wood, dirt path, wall, wall-side,
  roof, door, tree, fountain, crate. Formula palette (C-340).
- `assets/realm-of-self.tmj` — 30x20 town map: central plaza + fountain,
  four buildings (Archive/Bazaar/Hall/Workshop — one per cardinal exit),
  pond, tree border, dirt paths. Object layer defines: spawn point, 3
  signal-node positions, 4 exit zones tagged with `target_zone` (castle,
  realm-of-reason, realm-of-harmony, realm-of-meaning — per C-342's
  realm-of-self.json neighbors).
- NPCs: ECHO (hub agent) + ATHENA/DAO/SOFIA visiting from neighboring
  realms, each with one line of canon-flavored dialogue.
- citizen_history-aware: signal nodes check
  `SNAPSHOT.world.citizen_history` for `zone:"realm-of-self"` entries and
  start pre-completed (C-341 no-respawn, now realm-scoped).
- Exits are WIRED but not yet FUNCTIONAL — walking into one shows
  "traveling to X... not yet built" and bounces the player back. This is
  honest scaffolding, not a placeholder pretending to work.

## REPLACING THE PROCEDURAL TILESET WITH REAL ART (the actual next step)
`tileset.png` is procedural — solid colors + dithering, matching the C-340
formula palette so it's visually consistent with HIVE Citadel, but it is
NOT hand-crafted pixel art. To upgrade:

1. Download a CC0 16x16 tileset — recommended: Kenney "Micro Roguelike"
   (kenney.nl/assets/micro-roguelike, CC0, exactly this tile size/grid).
2. Open `assets/realm-of-self.tmj` in Tiled (mapeditor.org, free) — it's
   standard Tiled JSON, loads as-is.
3. In Tiled: Map > Tileset Properties, point at the new image (must stay
   16x16 tiles, but column count can differ — update `columns` in both the
   .tmj `tilesets[0]` AND `tileset.png`'s reference, or re-export).
4. Re-paint tiles using the new tileset's equivalents for: stone, grass,
   water, wall, roof, door, tree, fountain, crate (tile IDs 1-14 in the
   current sheet — `tilemap.js`'s `isSolid()` assumes wall/tree/etc. are
   IDs 8-14 on the SAME tileset; if the new tileset's solid tiles land at
   different IDs, update the range in `tilemap.js`).
5. Export > Tiled JSON, overwrite `realm-of-self.tmj`. No code changes
   needed in `index.html` — the loader is tileset-agnostic.

This is a content swap, not an engineering task — the loader was built so
this step requires zero JavaScript changes.

## Next zones
Repeat: author a `<zone-id>.tmj` per `world/zones/*.json` (C-342), reusing
`tilemap.js`. Wire each zone's exits to the next zone's spawn once that
zone exists — this is what makes the 4 exits here "functional."
