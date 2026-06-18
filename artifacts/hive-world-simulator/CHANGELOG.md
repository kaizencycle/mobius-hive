# HIVE 16-bit World Simulator — Changelog

## C-445 — Detailed character art

- Reworked the three character sprites to match richer reference designs (parametric PIL drawing + silhouette outline):
  - **Scout** (player, 24×24, down/up/side + horizontal flip): silver helmet, orange scarf, violet cape, steel armor, hip satchel, glowing teal chest shard.
  - **Realm keeper** (agent, 24×32): gold hood + robe holding a glowing tablet and a hanging emerald shard; subtle per-realm tint.
  - **Sentinel** (NEW, 24×32): dark armor, greathelm with a teal eye-slit, spear, glowing chest emblem — the Forge council is now visually distinct from realm keepers.
- Engine: 24px scout frames with right-facing flip, dedicated `sentinel` sprite for `kind=sentinel`, larger draw sizes, soft shadows, nameplates.

## C-344 — Per-realm fog + Chronicle

- **Per-realm Signal Fog.** Fog is now spatial, not a flat global vignette: rendered to an offscreen buffer and carved with `destination-out` so **sealed realms become fully-clear windows**, the player keeps a torch, and global density tracks live GI + how many realms remain. Reads optional live per-realm GI (`world.realm_integrity[id]` / `realm_gi`) so an unsealed zone clears proportionally when the substrate provides it.
- **Chronicle panel.** The objectives panel gains a **CHRONICLE** section that seeds from the live `citizen_history` (rendered defensively for string/object entries) and appends this session's deeds (each seal, the final restore). Survives replay (ledger history kept, session deeds reset). Pairs with the C-341 write-back hook so the same deeds the game posts to the parent can return as history next cycle.

## C-344 — Objectives + 50-point optimization pass

Added an objectives/task system, fixed the Oracle blocking the last Ocean shard,
and ran a 50-item optimization pass across performance, gameplay, UX,
accessibility, live-state, and robustness.

### Objectives & quest tracking
1. Objectives/task panel, toggled with **Q**, **Tab**, the **◧ OBJECTIVES** button, or **Esc** to close.
2. Main quest tracker — **Restore the Beacon** with two steps: *Sweep & seal the realms (X/9)* and *Restore the Forge Fountain*.
3. Per-realm checklist with live status: `not visited` → `shards x/3` → `light beacon` → `SEALED`.
4. Live **minimap**: hub marker, realm dots (sealed = filled + ring), and the player's position.
5. Objective toast fires on first contact with each realm keeper ("sweep N shards in …").
6. Objectives button shows seal progress (`X/9`) at a glance.
7. Panel auto-refreshes on talk / pickup / seal / win.

### Bug fixes
8. **Fixed the Oracle (and any NPC) blocking shards** — shards now spawn only on tiles proven reachable by a flood-fill from the player spawn.
9. Enlarged the **Ocean of Inquiry** island so the Oracle can be walked around.
10. Deterministic, spaced shard spread with a relaxed fallback for small islands.
11. Shards never overlap NPC / beacon / agent footprints.
12. Hardened beacon-tile validity check (walkable fallback).

### Performance
13. **Pre-baked static map layer** into one offscreen canvas — the whole tilemap blits as a single `drawImage` slice per frame.
14. Removed the per-tile draw loop (previously 300+ `drawImage` calls/frame).
15. Removed per-frame realm-tint composite passes (an `overlay` fill per ground tile) — tints are baked once.
16. Cached tinted ground variants per realm colour.
17. View-frustum **culling** for trees, beacons, shards, NPCs, and the fountain.
18. Integer-snapped camera for crisp nearest-neighbour blits (no subpixel shimmer).
19. Cached tinted agent sprites per realm colour (reused across frames).
20. Minimap redraw throttled (every 3rd frame, only while the panel is open).
21. `devicePixelRatio` capped at 2.
22. Fixed-timestep simulation with accumulator clamp (no spiral-of-death).
23. Pause-on-blur halts both simulation and render work.

### Input, UX & accessibility
24. Action edge latched on `keydown` so fast taps are never dropped.
25. Tap-to-advance on intro / win / dialog overlays (mobile).
26. Keyboard bound to physical `event.code` — safe on non-Latin layouts.
27. Gamepad support (face buttons + analog stick) polled in the loop.
28. Touch D-pad + action button; objectives reachable by touch.
29. `Esc` closes the dialog and the objectives panel.
30. Diagonal movement normalized (no diagonal speed boost).
31. Forgiving collision — the player hitbox (18px) is smaller than the sprite.
32. Contextual on-screen hint (`[E] TALK / TAKE SHARD / LIGHT BEACON / RESTORE`).
33. All player-visible strings externalized in `strings.js` — localization-ready.
34. Responsive canvas (`resize` + `orientationchange`).

### Live state & integrity
35. Live `current-world.json` overlay (repo root or `?data=`) with a `LIVE` / `SNAPSHOT` badge.
36. HUD GI/MIC reflect live `integrity.gi` / `vault.progress` (Codex P2 fix).
37. Gameplay sealing raises GI/MIC from the **live** base toward 1.0.
38. Vault progress and MIC derived consistently from seals.
39. Cycle id read from the live projection when present.

### Audio & feedback
40. WebAudio SFX for pick / talk / seal / deny / win (procedural — no audio assets).
41. Audio context resumes on first input (autoplay-policy safe).
42. Beacon glow + local fog-lift feedback on seal.

### Rendering polish
43. Signal Fog as a player-centred radial vignette that lifts as realms seal.
44. y-sorted entity draw for correct overlap.
45. Additive-blend glow for shards, beacons, and the fountain.

### Robustness & code quality
46. Deterministic world generation (seeded RNG) — identical layout every run.
47. Graceful asset-load fallback (`onerror`) — a missing PNG won't crash the game.
48. Live fetch fails safe to the baked snapshot (offline / CORS).
49. Dev overlay (`?dev=1`) with FPS, sealed count, and test hooks.
50. Lean ~24 KB deploy bundle; all art regenerable via `tools/gen_assets.py`.

## C-344 — Initial release
- 16-bit top-down HIVE world simulator: explore nine realms, sweep integrity shards, light beacons, restore the Forge Fountain. Built from `world/*.json`; deployed via the Higgsfield apps engine.
