/**
 * Mobius HIVE — 16-bit World Simulator (client).
 *
 * A top-down JRPG-style overworld of the HIVE civilization. The player is a
 * Scout who lifts the Signal Fog of cycle C-344 by sweeping integrity shards
 * from each realm and lighting its beacon (Sweep -> Seal). Seal every realm and
 * the central Fountain unlocks: restore the Beacon to seal the cycle (Ledger).
 *
 * Live-state aware: when served from the mobius-hive repo root (or with
 * ?data=<base>), it overlays world/current-world.json onto the baked snapshot.
 */
import { STR } from "./strings.js";
import { WORLD_SNAPSHOT } from "./world-snapshot.js";

// ---------------------------------------------------------------- constants
const TILE = 32;                       // world px per tile
const MAP_W = 60, MAP_H = 46;
const HX = 30, HY = 23;                // hub (Forge) center, in tiles
const REGION_R = 5;                    // realm region radius, tiles
const ZOOM = 2;                        // device-independent pixel zoom
const SPEED = 2.3;                     // world px per fixed step
const STEP = 1000 / 60;
const INTERACT_R = 42;                 // world px
const SHARD_PICK_R = 18;
const SHARDS_PER_REALM = 3;
const GI_BASE = WORLD_SNAPSHOT.integrity.gi;

const VOID = 0, GROUND = 1, PATH = 2, WATER = 3, WALL = 4, FLOOR = 5;
const WALKABLE = new Set([GROUND, PATH, FLOOR]);

// deterministic RNG (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------------------- assets
const ASSET_FILES = {
  ground: "ground.png", path: "path.png", water: "water.png", wall: "wall.png",
  floor: "floor.png", scout: "scout.png", agent: "agent.png", sentinel: "sentinel.png",
  shard: "shard.png", beacon: "beacon.png", tree: "tree.png", fountain: "fountain.png",
};
const IMG = {};
function loadAssets() {
  return Promise.all(Object.entries(ASSET_FILES).map(([k, f]) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { IMG[k] = im; res(); };
    im.onerror = () => { IMG[k] = null; res(); };
    im.src = "./assets/" + f;
  })));
}

// tint a source image with a colour (cached) -> returns canvas
const _tintCache = new Map();
function tinted(img, color, alpha) {
  if (!img) return null;
  const key = img.src + color + alpha;
  if (_tintCache.has(key)) return _tintCache.get(key);
  const cv = document.createElement("canvas");
  cv.width = img.width; cv.height = img.height;
  const x = cv.getContext("2d");
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "source-atop";
  x.globalAlpha = alpha;
  x.fillStyle = color;
  x.fillRect(0, 0, cv.width, cv.height);
  _tintCache.set(key, cv);
  return cv;
}

// ----------------------------------------------------------------- world
const map = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(GROUND));
const realmAt = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(-1));
const blockedObj = new Set();          // "tx,ty" -> blocked footprint
const trees = [];
let realms = [];                       // runtime realm objects (non-hub)
let npcs = [];
let fountain = null;
const realmDefs = WORLD_SNAPSHOT.realms.filter((r) => !r.hub);
const hubDef = WORLD_SNAPSHOT.realms.find((r) => r.hub);

const tkey = (x, y) => x + "," + y;
const inBounds = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
const wcx = (tx) => tx * TILE + TILE / 2;

function setTile(x, y, c) { if (inBounds(x, y)) map[y][x] = c; }

// vertical-first L-route from the hub centre outward (clean spokes + bridges)
function carvePath(x0, y0, x1, y1) {
  let x = x0, y = y0;
  const lay = () => { if (map[y][x] === GROUND || map[y][x] === WATER || map[y][x] === WALL) setTile(x, y, PATH); };
  while (y !== y1) { lay(); y += y1 > y ? 1 : -1; }
  while (x !== x1) { lay(); x += x1 > x ? 1 : -1; }
  lay();
}

function buildWorld() {
  const rand = rng(0x344C0DE);

  // borders -> void
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2) setTile(x, y, VOID);
  }

  // realm ring
  const n = realmDefs.length;
  const centers = realmDefs.map((def, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { def, i, cx: Math.round(HX + Math.cos(a) * 20), cy: Math.round(HY + Math.sin(a) * 14) };
  });

  for (const { def, i, cx, cy } of centers) {
    const ocean = def.id === "ocean-of-inquiry";
    for (let dy = -REGION_R; dy <= REGION_R; dy++) for (let dx = -REGION_R; dx <= REGION_R; dx++) {
      const x = cx + dx, y = cy + dy;
      if (!inBounds(x, y) || map[y][x] === VOID) continue;
      if (dx * dx + dy * dy > REGION_R * REGION_R) continue;
      realmAt[y][x] = i;
      if (ocean) setTile(x, y, (dx * dx + dy * dy <= 8) ? GROUND : WATER);
    }
    // ring of trees around the region
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + i;
      const tx = Math.round(cx + Math.cos(a) * (REGION_R + 0.4));
      const ty = Math.round(cy + Math.sin(a) * (REGION_R + 0.4));
      if (inBounds(tx, ty) && map[ty][tx] === GROUND && !blockedObj.has(tkey(tx, ty))) {
        trees.push({ wx: wcx(tx), wy: wcx(ty) }); blockedObj.add(tkey(tx, ty));
      }
    }
  }

  // hub castle: floor courtyard + wall ring with gates carved by paths
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = HX + dx, y = HY + dy;
    const edge = Math.abs(dx) === 4 || Math.abs(dy) === 4;
    setTile(x, y, edge ? WALL : FLOOR);
  }

  // paths: hub centre -> each realm centre (creates wall gates automatically)
  for (const { cx, cy } of centers) carvePath(HX, HY, cx, cy);

  // fountain object (2x2 footprint) at hub centre
  fountain = { wx: HX * TILE + TILE, wy: (HY - 1) * TILE + TILE, ready: false, active: false };
  for (const [bx, by] of [[HX, HY - 1], [HX - 1, HY - 1], [HX, HY], [HX - 1, HY]]) blockedObj.add(tkey(bx, by));

  // realm runtime objects: agent + beacon (shards placed after all blocks set)
  realms = centers.map(({ def, i, cx, cy }) => {
    const color = def.color;
    const beaconT = { x: cx, y: cy - 2 };
    if (!(map[beaconT.y] && WALKABLE.has(map[beaconT.y][beaconT.x] ?? VOID))) beaconT.y = cy - 1;
    blockedObj.add(tkey(beaconT.x, beaconT.y));
    const agentT = { x: cx, y: cy + 1 };
    blockedObj.add(tkey(agentT.x, agentT.y));

    const ag = WORLD_SNAPSHOT.agents[def.agent] || { name: def.agent.toUpperCase(), role: "", lines: [def.blurb] };
    npcs.push({ id: def.agent, kind: "agent", name: ag.name, role: ag.role, lines: ag.lines,
      wx: wcx(agentT.x), wy: wcx(agentT.y), color, realm: i });

    return { def, i, cx, cy, color, beacon: { ...beaconT, wx: wcx(beaconT.x), wy: wcx(beaconT.y) },
      shards: [], talked: false, sealed: false, revealed: false, total: SHARDS_PER_REALM };
  });

  // hub sentinels + greeter, placed around the courtyard
  const hubSpots = [
    ["aurelius", HX - 2, HY + 3], ["zeus", HX + 2, HY - 2], ["jade", HX - 2, HY - 2],
    ["hermes", HX + 2, HY + 2], ["atlas", HX - 2, HY + 1], ["aurea", HX + 2, HY + 0],
  ];
  for (const [id, tx, ty] of hubSpots) {
    const s = WORLD_SNAPSHOT.sentinels[id];
    const ag = WORLD_SNAPSHOT.agents[id];
    const info = s || ag;
    const lines = s ? Object.values(s.lines || { default: "…" }) : (ag ? ag.lines : ["…"]);
    npcs.push({ id, kind: "sentinel", name: info.name, role: info.role || "",
      lines, wx: wcx(tx), wy: wcx(ty), color: hubDef.color, hub: true });
    blockedObj.add(tkey(tx, ty));
  }

  // reachable flood-fill from the player spawn over walkable, unblocked tiles
  reachableSet = computeReachable(Math.floor(player.wx / TILE), Math.floor(player.wy / TILE));
  // shards: only on reachable tiles in each realm's ring (never trapped behind an NPC)
  for (const r of realms) placeShards(r, reachableSet, rand);
}
let reachableSet = new Set();

// flood fill: tiles the player can actually stand on / walk to
function computeReachable(sx, sy) {
  const seen = new Set();
  const start = tkey(sx, sy);
  if (!walkTile(sx, sy)) return seen;            // spawn must be walkable
  const q = [[sx, sy]]; seen.add(start);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = tkey(nx, ny);
      if (seen.has(k) || !walkTile(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}
function walkTile(x, y) {
  return inBounds(x, y) && WALKABLE.has(map[y][x]) && !blockedObj.has(tkey(x, y));
}

function placeShards(r, reachable, rand) {
  const { cx, cy } = r;
  // candidate ring tiles, reachable and not blocked, sorted near->far for tidy spread
  const cand = [];
  for (let dy = -REGION_R; dy <= REGION_R; dy++) for (let dx = -REGION_R; dx <= REGION_R; dx++) {
    const d2 = dx * dx + dy * dy;
    if (d2 < 2 || d2 > REGION_R * REGION_R) continue;
    const x = cx + dx, y = cy + dy;
    if (!reachable.has(tkey(x, y))) continue;
    cand.push({ x, y, d2 });
  }
  // shuffle deterministically, then greedily pick spaced-out tiles
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const chosen = [];
  for (const c of cand) {
    if (chosen.length >= SHARDS_PER_REALM) break;
    if (chosen.some((s) => Math.abs(s.x - c.x) + Math.abs(s.y - c.y) < 2)) continue;
    chosen.push(c);
  }
  // fallback: if spacing was too strict (tiny island), relax it
  for (const c of cand) { if (chosen.length >= SHARDS_PER_REALM) break; if (!chosen.includes(c)) chosen.push(c); }
  r.shards = chosen.slice(0, SHARDS_PER_REALM).map((c) => ({ tx: c.x, ty: c.y, wx: wcx(c.x), wy: wcx(c.y), taken: false }));
  r.total = r.shards.length;
}

// ----------------------------------------------------------------- state
const player = {
  wx: wcx(HX), wy: (HY + 6) * TILE + 16, dir: "up", step: 0, anim: 0,
  // RPG stats (MMORPG layer, C-353)
  hp: 100, maxHp: 100, mp: 60, maxMp: 60, xp: 0, xpNext: 100, level: 1, mic: 60,
};
let sealedCount = 0;
let won = false;
let started = false;
let live = false;
let liveCycle = WORLD_SNAPSHOT.cycle;
let dialog = null, dialogLine = 0;
let nearHint = "";
let chronicle = [];   // Chronicle: live citizen_history (from world JSON) + this session's deeds
const 
  el = (id) => document.getElementById(id);

function pushChronicle(entry) {
  chronicle.unshift(entry);
  if (chronicle.length > 40) chronicle.length = 40;
  if (objectivesOpen) buildObjectives();
}
function formatHistory(e) {
  if (e == null) return "…";
  if (typeof e === "string") return e;
  return e.title || e.label || e.summary || e.text ||
    `${e.type || e.action || "event"}${e.realm ? " · " + e.realm : ""}${e.cycle ? " · " + e.cycle : ""}`;
}

// integrity/vault baselines — overridden by live current-world.json when found,
// then gameplay (sealing realms) raises them toward 1.0
let giBase = GI_BASE;
let vaultBase = WORLD_SNAPSHOT.vault.progress;
function giNow() { return Math.min(1, giBase + (sealedCount / realms.length) * (1 - giBase)); }
function vaultNow() { return Math.min(1, vaultBase + (sealedCount / realms.length) * (1 - vaultBase)); }
function micNow() { return Math.round(player.mic); }   // spendable MIC wallet (MMORPG economy)

// ----------------------------------------------------- RPG progression
function gainMic(amt) { player.mic = Math.max(0, player.mic + amt); syncHud(); }
function spendMic(amt) { if (player.mic < amt) return false; player.mic -= amt; syncHud(); return true; }
function gainGI(amt) { giBase = Math.max(0, Math.min(1, giBase + amt)); syncHud(); }
function heal(amt) { player.hp = Math.min(player.maxHp, player.hp + amt); syncHud(); }
function damage(amt) { player.hp = Math.max(0, player.hp - amt); syncHud(); return player.hp <= 0; }
function gainXP(amt) {
  player.xp += amt;
  while (player.xp >= player.xpNext) {
    player.xp -= player.xpNext; player.level++;
    player.xpNext = Math.round(player.xpNext * 1.4);
    player.maxHp += 12; player.maxMp += 6; player.hp = player.maxHp; player.mp = player.maxMp;
    toast(`LEVEL UP \u2192 ${player.level}`); sfx("win");
    pushChronicle({ kind: "session", text: `Reached level ${player.level}`, cycle: liveCycle, color: "#c4b5fd" });
    emitEvent("level_up", { level: player.level });
  }
  syncHud();
}

// --------------------------------------------------- embed integration
// The game is designed to live inside the Mobius browser shell's HIVE chamber
// as a cross-origin iframe. The shell passes ?data=<worldBase> (live overlay,
// handled in tryLive) and ?muted=1 (no autoplay sound). Progress is emitted to
// the parent frame via postMessage AND mirrored on window.__hivePendingEvent so
// the shell can write citizen_history to the ledger (C-341 write-back hook).
const MUTED = new URLSearchParams(location.search).get("muted") === "1";
function emitEvent(type, extra) {
  const payload = Object.assign({
    source: "mobius-hive-sim", type, cycle: liveCycle, live,
    gi: giNow(), vault: vaultNow(), mic: micNow(),
    sealed: sealedCount, total: realms.length, won, ts: Date.now(),
  }, extra || {});
  try { window.__hivePendingEvent = payload; } catch (e) { /* sandboxed */ }
  try { if (window.parent && window.parent !== window) window.parent.postMessage(payload, "*"); } catch (e) { /* cross-origin */ }
}

// ------------------------------------------------------------------- audio
let actx = null;
function sfx(type) {
  if (MUTED) return;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    const o = actx.createOscillator(), g = actx.createGain();
    const t = actx.currentTime;
    const cfg = {
      pick: [880, 1320, "triangle", 0.18], talk: [330, 392, "square", 0.12],
      seal: [523, 1046, "sawtooth", 0.35], deny: [200, 120, "square", 0.18],
      win: [523, 1568, "triangle", 0.7],
    }[type] || [440, 660, "sine", 0.15];
    o.type = cfg[2];
    o.frequency.setValueAtTime(cfg[0], t);
    o.frequency.exponentialRampToValueAtTime(cfg[1], t + cfg[3] * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + cfg[3]);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + cfg[3] + 0.02);
  } catch (e) { /* audio optional */ }
}

// ------------------------------------------------------------------- input
const BIND = { KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right",
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  Space: "action", Enter: "action", KeyE: "action" };
const PAD = { 0: "action", 9: "action", 12: "up", 13: "down", 14: "left", 15: "right" };
const held = new Set();
const touch = new Set();
let prevAction = false, pendingAction = false;

addEventListener("keydown", (e) => {
  if (e.code === "KeyQ" || e.code === "Tab") { toggleObjectives(); e.preventDefault(); return; }
  if (e.code === "Escape") { closeAll(); toggleObjectives(false); return; }
  if (/^Digit[1-4]$/.test(e.code)) { useSkill(+e.code.slice(5) - 1); e.preventDefault(); return; }
  const c = BIND[e.code]; if (!c) return;
  if (c === "action" && !held.has("action")) pendingAction = true;   // latch edge for fast taps
  held.add(c); e.preventDefault();
});
addEventListener("keyup", (e) => { const c = BIND[e.code]; if (c) held.delete(c); });

function padCommands() {
  const out = new Set();
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    gp.buttons.forEach((b, i) => { if (b.pressed && PAD[i]) out.add(PAD[i]); });
    const ax = gp.axes || [];
    if (ax[0] < -0.4) out.add("left"); if (ax[0] > 0.4) out.add("right");
    if (ax[1] < -0.4) out.add("up"); if (ax[1] > 0.4) out.add("down");
  }
  return out;
}
function commands() { return new Set([...held, ...touch, ...padCommands()]); }

function bindTouch() {
  const dp = el("dpad");
  const press = (k, on) => (e) => { e.preventDefault(); on ? touch.add(k) : touch.delete(k); };
  dp.querySelectorAll("button").forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener("touchstart", press(k, true), { passive: false });
    b.addEventListener("touchend", press(k, false), { passive: false });
    b.addEventListener("touchcancel", press(k, false), { passive: false });
    b.addEventListener("pointerdown", press(k, true));
    b.addEventListener("pointerup", press(k, false));
    b.addEventListener("pointerleave", press(k, false));
  });
  const a = el("abtn");
  const tap = (e) => { e.preventDefault(); pendingAction = true; touch.add("action"); setTimeout(() => touch.delete("action"), 60); };
  a.addEventListener("touchstart", tap, { passive: false });
  a.addEventListener("pointerdown", tap);
  // tap-to-advance for overlays / dialog (they sit above the touch pad)
  for (const id of ["intro", "win", "dialog"]) {
    el(id).addEventListener("pointerdown", (e) => { e.preventDefault(); pendingAction = true; });
  }
  const ob = el("objbtn");
  if (ob) ob.addEventListener("click", (e) => { e.preventDefault(); toggleObjectives(); });
  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) el("touch").classList.add("show");
}

// ------------------------------------------------------------- collision
function walkAt(wx, wy) {
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  if (!inBounds(tx, ty)) return false;
  if (!WALKABLE.has(map[ty][tx])) return false;
  if (blockedObj.has(tkey(tx, ty))) return false;
  return true;
}
const HALF = 9;
function tryMove(dx, dy) {
  const nx = player.wx + dx;
  if (walkAt(nx - HALF, player.wy - HALF) && walkAt(nx + HALF, player.wy - HALF) &&
      walkAt(nx - HALF, player.wy + HALF) && walkAt(nx + HALF, player.wy + HALF)) player.wx = nx;
  const ny = player.wy + dy;
  if (walkAt(player.wx - HALF, ny - HALF) && walkAt(player.wx + HALF, ny - HALF) &&
      walkAt(player.wx - HALF, ny + HALF) && walkAt(player.wx + HALF, ny + HALF)) player.wy = ny;
}

// ------------------------------------------------------------- interaction
function nearestInteractable() {
  let best = null, bestD = INTERACT_R * INTERACT_R;
  for (const npc of npcs) {
    const d = (npc.wx - player.wx) ** 2 + (npc.wy - player.wy) ** 2;
    if (d < bestD) { bestD = d; best = { type: "npc", npc }; }
  }
  for (const r of realms) {
    const d = (r.beacon.wx - player.wx) ** 2 + (r.beacon.wy - player.wy) ** 2;
    if (d < bestD) { bestD = d; best = { type: "beacon", realm: r }; }
  }
  const fd = (fountain.wx - player.wx) ** 2 + (fountain.wy - player.wy) ** 2;
  if (fd < (INTERACT_R + 14) ** 2 && fd < bestD) { bestD = fd; best = { type: "fountain" }; }
  for (const p of overworldPortals) {
    const d = (p.wx - player.wx) ** 2 + (p.wy - player.wy) ** 2;
    if (d < bestD) { bestD = d; best = { type: "portal", portal: p }; }
  }
  return best;
}

function realmTitle(i) { return realmDefs[i].title; }

function doInteract() {
  if (instance) { interactInstance(); return; }
  const it = nearestInteractable();
  if (!it) return;
  if (it.type === "portal") { enterInstance(it.portal.dest); return; }
  if (it.type === "npc") {
    const npc = it.npc;
    let lines = npc.lines.slice();
    if (npc.kind === "agent" && npc.realm != null) {
      const r = realms[npc.realm];
      if (!r.sealed) {
        const first = !r.talked;
        if (first) { r.talked = true; revealShards(r); syncHud(); }
        if (first && r.total) toast(STR.objective_hint.replace("{n}", r.total).replace("{realm}", realmTitle(r.i)));
        lines = [...npc.lines, r.shards.every((s) => s.taken) ? STR.task_done
          : STR.task_sweep.replace("{n}", r.total)];
      } else lines = [`${realmTitle(r.i)} stands sealed. The fog has lifted here.`];
    }
    if (npc.id === "zeus") {
      const z = WORLD_SNAPSHOT.sentinels.zeus.lines;
      if (won) lines = [z.complete];
      else if (sealedCount >= realms.length) lines = [z.ready];
      else lines = [z.default, z.active];
    }
    openDialog(npc.name, lines);
    sfx("talk");
    return;
  }
  if (it.type === "beacon") {
    const r = it.realm;
    if (r.sealed) { toast(STR.hint_beacon_done); return; }
    if (!r.talked || !r.shards.every((s) => s.taken)) { toast(STR.hint_beacon_locked); sfx("deny"); return; }
    sealRealm(r);
    return;
  }
  if (it.type === "fountain") {
    if (sealedCount < realms.length) { toast(STR.hint_fountain_locked); sfx("deny"); return; }
    if (!won) winGame();
  }
}

function revealShards(r) { /* shards become visible+collectable once realm agent is met */ r.revealed = true; }

function sealRealm(r) {
  r.sealed = true; sealedCount++;
  sfx("seal");
  toast(STR.beacon_lit.replace("{realm}", realmTitle(r.i)));
  syncHud();
  pushChronicle({ kind: "session", text: `Sealed ${realmTitle(r.i)}`, cycle: liveCycle, color: r.color });
  emitEvent("seal", { realm: r.def.id, realmTitle: realmTitle(r.i), realmColor: r.color });
  if (sealedCount >= realms.length) { fountain.ready = true; toast(STR.fountain_unlocked); emitEvent("fountain_ready"); }
}

function winGame() {
  won = true; fountain.active = true; fountain.ready = true;
  sfx("win");
  el("winsub").textContent = STR.win_title;
  el("wintitle").textContent = "RESTORED";
  el("winbody").textContent = STR.win_body;
  el("winjade").textContent = STR.win_jade;
  el("wincta").textContent = STR.win_again;
  el("win").classList.add("show");
  syncHud();
  pushChronicle({ kind: "session", text: `Restored the Beacon — ${liveCycle} sealed`, cycle: liveCycle, color: "#e8c547" });
  emitEvent("win");
}

// --------------------------------------------------------------- dialog/ui
function openDialog(who, lines) { dialog = { who, lines }; dialogLine = 0; renderDialog(); }
function renderDialog() {
  if (!dialog) { el("dialog").classList.remove("show"); return; }
  el("dwho").textContent = dialog.who;
  el("dtxt").textContent = dialog.lines[dialogLine] || "…";
  el("dmore").textContent = dialogLine < dialog.lines.length - 1 ? "[E] ▾" : "[E] ✕";
  el("dialog").classList.add("show");
}
function advanceDialog() {
  if (!dialog) return;
  dialogLine++;
  if (dialogLine >= dialog.lines.length) { dialog = null; renderDialog(); } else renderDialog();
}
let toastT = 0;
function toast(msg) { el("toast").textContent = msg; el("toast").classList.add("show"); toastT = 180; }
function closeAll() { dialog = null; renderDialog(); }

// ----------------------------------------------------------- objectives
let objectivesOpen = false;
function toggleObjectives(force) {
  objectivesOpen = force != null ? force : !objectivesOpen;
  el("objectives").classList.toggle("show", objectivesOpen);
  if (objectivesOpen) buildObjectives();
}
function buildObjectives() {
  const sealedFrac = `${sealedCount}/${realms.length}`;
  const fountainStep = sealedCount >= realms.length
    ? `<div class="step ${won ? "done" : ""}">${won ? "\u2713" : "\u25c8"} ${STR.obj_step_fountain}</div>`
    : `<div class="step">\u25cb ${STR.obj_step_fountain_locked}</div>`;
  let html = `<div class="q">${STR.obj_quest}</div>`;
  html += `<div class="step ${sealedCount >= realms.length ? "done" : ""}">` +
    `${sealedCount >= realms.length ? "\u2713" : "\u25c8"} ${STR.obj_step_seal} \u2014 ${sealedFrac}</div>`;
  html += fountainStep;
  html += `<div class="hdr">${STR.obj_realms}</div>`;
  for (const r of realms) {
    let icon = "\u25cb", cls = "", st = STR.st_new;
    if (r.sealed) { icon = "\u2713"; cls = "ok"; st = STR.st_sealed; }
    else if (r.talked) {
      const got = r.shards.filter((s) => s.taken).length;
      cls = "go";
      st = got >= r.total ? STR.st_ready : STR.st_go.replace("{got}", got).replace("{total}", r.total);
      icon = "\u25cf";
    }
    html += `<div class="realm"><span style="color:${r.color}">${icon} ${realmTitle(r.i)}</span>` +
      `<span class="st ${cls}">${st}</span></div>`;
  }
  html += `<div class="hdr">${STR.obj_chronicle}</div>`;
  if (!chronicle.length) html += `<div class="chron muted">${STR.chronicle_empty}</div>`;
  else for (const c of chronicle.slice(0, 10)) {
    const col = c.kind === "session" ? (c.color || "#8cffa8") : "#9a9ac0";
    const mark = c.kind === "session" ? "\u2726" : "\u00b7";
    html += `<div class="chron"><span style="color:${col}">${mark}</span> ${c.text}` +
      `${c.cycle ? ` <span class="muted">${c.cycle}</span>` : ""}</div>`;
  }
  el("objbody").innerHTML = html;
  el("objtitle").textContent = STR.obj_title;
  el("objclose").textContent = STR.obj_close;
}
function drawMinimap() {
  const cv = el("map"); if (!cv) return;
  const m = cv.getContext("2d");
  const W = cv.width, H = cv.height, pad = 8;
  const sx = (W - pad * 2) / (MAP_W * TILE), sy = (H - pad * 2) / (MAP_H * TILE);
  m.clearRect(0, 0, W, H);
  m.fillStyle = "#0b0a1f"; m.fillRect(0, 0, W, H);
  // hub
  m.fillStyle = hubDef.color; m.fillRect(pad + HX * TILE * sx - 2, pad + HY * TILE * sy - 2, 4, 4);
  for (const r of realms) {
    const x = pad + r.cx * TILE * sx, y = pad + r.cy * TILE * sy;
    m.fillStyle = r.sealed ? r.color : "rgba(120,120,160,.7)";
    m.beginPath(); m.arc(x, y, r.sealed ? 4 : 3, 0, 7); m.fill();
    if (r.sealed) { m.strokeStyle = r.color; m.lineWidth = 1; m.beginPath(); m.arc(x, y, 6, 0, 7); m.stroke(); }
  }
  // player
  m.fillStyle = "#3dffea";
  m.fillRect(pad + player.wx * sx - 2, pad + player.wy * sy - 2, 4, 4);
}

function syncHud() {
  const btn = el("objbtn");
  if (btn) btn.innerHTML = `${STR.obj_btn} <b>${sealedCount}/${realms.length}</b>`;
  if (objectivesOpen) buildObjectives();
  const gi = Math.round(giNow() * 100);
  const tag = live ? `<span class="aqua pill">${STR.hud_live}</span>` : `<span class="muted pill">${STR.hud_demo}</span>`;
  const zone = instance ? instance.name : STR.title;
  el("hud").innerHTML = `
    <span class="gold pill">${zone}</span>
    <span class="gold pill">${STR.hud_cycle} ${liveCycle}</span>
    <span class="purple pill">LVL ${player.level}</span>
    <span class="gold pill">${STR.hud_mic} ${micNow()}</span>
    <span class="green pill">${STR.hud_gi} ${gi}%</span>
    <span class="aqua pill">${STR.hud_realms} ${sealedCount}/${realms.length}</span>
    <span class="${won ? "green" : "red"} pill">${STR.hud_event} ${won ? "CLEAR" : WORLD_SNAPSHOT.event.title}</span>
    ${tag}`;
  // RPG stat bars
  const setBar = (id, val, max) => { const e = el(id); if (e) e.style.width = Math.max(0, Math.min(100, (val / max) * 100)) + "%"; };
  setBar("bar-hp", player.hp, player.maxHp);
  setBar("bar-mp", player.mp, player.maxMp);
  setBar("bar-xp", player.xp, player.xpNext);
  const lbl = el("rpg-label");
  if (lbl) lbl.textContent = `HP ${Math.round(player.hp)}/${player.maxHp}  MP ${Math.round(player.mp)}/${player.maxMp}`;
}

// ---------------------------------------------------------------- render
const canvas = el("c"), ctx = canvas.getContext("2d");
const fogCanvas = document.createElement("canvas"), fctx = fogCanvas.getContext("2d");
let DPR = 1;
let camX = 0, camY = 0;
let viewW = 0, viewH = 0;

// pre-baked static map layer: the whole tilemap (with realm tints baked) drawn
// once into an offscreen canvas, then blitted as a single visible slice per
// frame — eliminates the per-tile loop and per-frame composite passes.
let mapCanvas = null;
const _groundCache = new Map();
function tintedGround(color) {
  if (_groundCache.has(color)) return _groundCache.get(color);
  const cv = document.createElement("canvas"); cv.width = TILE; cv.height = TILE;
  const x = cv.getContext("2d");
  if (IMG.ground) x.drawImage(IMG.ground, 0, 0);
  x.globalCompositeOperation = "overlay"; x.globalAlpha = 0.3; x.fillStyle = color;
  x.fillRect(0, 0, TILE, TILE);
  _groundCache.set(color, cv); return cv;
}
function buildMapCanvas() {
  mapCanvas = document.createElement("canvas");
  mapCanvas.width = MAP_W * TILE; mapCanvas.height = MAP_H * TILE;
  const m = mapCanvas.getContext("2d"); m.imageSmoothingEnabled = false;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const c = map[y][x];
    if (c === VOID) continue;
    let img = IMG.ground;
    if (c === PATH) img = IMG.path; else if (c === WATER) img = IMG.water;
    else if (c === WALL) img = IMG.wall; else if (c === FLOOR) img = IMG.floor;
    else if (c === GROUND) { const ri = realmAt[y][x]; if (ri >= 0) img = tintedGround(realms[ri].color); }
    if (img) m.drawImage(img, x * TILE, y * TILE);
  }
}
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  DPR = dpr;
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  fogCanvas.width = canvas.width; fogCanvas.height = canvas.height;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  viewW = innerWidth; viewH = innerHeight;
}
addEventListener("resize", resize); addEventListener("orientationchange", resize);

function S(wx) { return (wx - camX) * ZOOM; }       // world -> screen
function blit(img, wx, wy, w, h) {
  if (!img) return;
  ctx.drawImage(img, Math.round((wx - camX) * ZOOM), Math.round((wy - camY) * ZOOM), Math.round(w * ZOOM), Math.round(h * ZOOM));
}

function render(frame) {
  ctx.imageSmoothingEnabled = false;
  if (instance) { renderInstance(frame); return; }
  // camera (integer-snapped for crisp nearest-neighbour blits)
  const vwW = viewW / ZOOM, vwH = viewH / ZOOM;
  camX = Math.floor(Math.max(2 * TILE, Math.min(MAP_W * TILE - 2 * TILE - vwW, player.wx - vwW / 2)));
  camY = Math.floor(Math.max(2 * TILE, Math.min(MAP_H * TILE - 2 * TILE - vwH, player.wy - vwH / 2)));

  ctx.fillStyle = "#05040f";
  ctx.fillRect(0, 0, viewW, viewH);

  // static map layer: one drawImage of the visible slice
  if (mapCanvas) {
    const sw = Math.min(MAP_W * TILE - camX, Math.ceil(vwW) + 1);
    const sh = Math.min(MAP_H * TILE - camY, Math.ceil(vwH) + 1);
    ctx.drawImage(mapCanvas, camX, camY, sw, sh, 0, 0, sw * ZOOM, sh * ZOOM);
  }

  // collect drawables (y-sorted, culled to the view)
  const vwW2 = viewW / ZOOM, vwH2 = viewH / ZOOM;
  const cull = (wx, wy) => wx > camX - 64 && wx < camX + vwW2 + 64 && wy > camY - 80 && wy < camY + vwH2 + 80;
  const draw = [];
  for (const t of trees) if (cull(t.wx, t.wy)) draw.push({ y: t.wy, fn: () => blit(IMG.tree, t.wx - 20, t.wy - 48, 40, 60) });
  for (const r of realms) {
    const cell = r.sealed ? 1 : 0;
    if (cull(r.beacon.wx, r.beacon.wy)) draw.push({ y: r.beacon.wy, fn: () => {
      const im = IMG.beacon;
      if (im) ctx.drawImage(im, cell * 32, 0, 32, 48,
        Math.round((r.beacon.wx - 18 - camX) * ZOOM), Math.round((r.beacon.wy - 50 - camY) * ZOOM),
        Math.round(36 * ZOOM), Math.round(54 * ZOOM));
      if (r.sealed) glow(r.beacon.wx, r.beacon.wy - 28, 26, r.color, frame);
    } });
    for (const s of r.shards) {
      if (s.taken || !r.revealed || !cull(s.wx, s.wy)) continue;
      const bob = Math.sin(frame * 0.06 + s.wx) * 3;
      draw.push({ y: s.wy, fn: () => { glow(s.wx, s.wy + bob, 12, "#3dffea", frame); blit(IMG.shard, s.wx - 12, s.wy - 12 + bob, 24, 24); } });
    }
  }
  // fountain
  if (cull(fountain.wx, fountain.wy)) draw.push({ y: fountain.wy, fn: () => {
    const im = IMG.fountain, cell = fountain.active ? 1 : 0;
    if (im) ctx.drawImage(im, cell * 48, 0, 48, 48,
      Math.round((fountain.wx - 32 - camX) * ZOOM), Math.round((fountain.wy - 44 - camY) * ZOOM),
      Math.round(64 * ZOOM), Math.round(64 * ZOOM));
    if (fountain.active) glow(fountain.wx, fountain.wy - 16, 40, "#e8c547", frame);
    else if (fountain.ready) glow(fountain.wx, fountain.wy - 16, 30, "#3dffea", frame);
  } });
  // npcs
  for (const npc of npcs) if (cull(npc.wx, npc.wy)) draw.push({ y: npc.wy, fn: () => drawNpc(npc, frame) });
  // travel portals (to instanced maps)
  for (const p of overworldPortals) if (cull(p.wx, p.wy)) draw.push({ y: p.wy, fn: () => {
    glow(p.wx, p.wy, 20, p.color, frame);
    const im = IMG.fountain;
    if (im) ctx.drawImage(im, 48, 0, 48, 48, Math.round((p.wx - 24 - camX) * ZOOM), Math.round((p.wy - 36 - camY) * ZOOM), Math.round(48 * ZOOM), Math.round(48 * ZOOM));
    ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = "center"; ctx.fillStyle = p.color;
    ctx.fillText(p.label, (p.wx - camX) * ZOOM, (p.wy - 30 - camY) * ZOOM);
  } });
  // player
  draw.push({ y: player.wy, fn: () => drawPlayer(frame) });

  draw.sort((a, b) => a.y - b.y);
  for (const d of draw) d.fn();

  // signal fog
  drawFog(frame);

  // live minimap while objectives panel is open
  if (objectivesOpen && frame % 3 === 0) drawMinimap();

  drawHint();
}

function glow(wx, wy, r, color, frame) {
  const sx = (wx - camX) * ZOOM, sy = (wy - camY) * ZOOM, rr = r * ZOOM * (0.85 + 0.15 * Math.sin(frame * 0.1));
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
  g.addColorStop(0, color + "cc"); g.addColorStop(0.4, color + "55"); g.addColorStop(1, color + "00");
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 7); ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

function drawNpc(npc, frame) {
  const bob = Math.sin(frame * 0.05 + npc.wx) * 2;
  const isSent = npc.kind === "sentinel";
  const img = isSent ? (IMG.sentinel || IMG.agent) : (tinted(IMG.agent, npc.color, 0.3) || IMG.agent);
  const DW = 36, DH = 48;
  // soft shadow
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.beginPath(); ctx.ellipse((npc.wx - camX) * ZOOM, (npc.wy + 10 - camY) * ZOOM, 11 * ZOOM, 4 * ZOOM, 0, 0, 7); ctx.fill();
  blit(img, npc.wx - DW / 2, npc.wy - DH + 12 + bob, DW, DH);
  // nameplate just above the head
  ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  const sx = (npc.wx - camX) * ZOOM, sy = (npc.wy - camY) * ZOOM;
  ctx.fillStyle = npc.color; ctx.fillText(npc.name, sx, sy - 40 * ZOOM);
}

function drawPlayer(frame) {
  const dirFrame = { down: 0, up: 1, left: 2, right: 2 };
  const fi = dirFrame[player.dir] ?? 0;
  const flip = player.dir === "right";
  const im = IMG.scout;
  const DW = 40, DH = 40, SW = 24, SH = 24;
  const bob = player.anim ? -1 : 0;
  const dx = Math.round((player.wx - DW / 2 - camX) * ZOOM);
  const dy = Math.round((player.wy - DH + 14 + bob - camY) * ZOOM);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.ellipse((player.wx - camX) * ZOOM, (player.wy + 12 - camY) * ZOOM, 12 * ZOOM, 4 * ZOOM, 0, 0, 7); ctx.fill();
  if (!im) return;
  if (flip) {
    ctx.save(); ctx.translate(dx + DW * ZOOM, dy); ctx.scale(-1, 1);
    ctx.drawImage(im, fi * SW, 0, SW, SH, 0, 0, DW * ZOOM, DH * ZOOM); ctx.restore();
  } else {
    ctx.drawImage(im, fi * SW, 0, SW, SH, dx, dy, DW * ZOOM, DH * ZOOM);
  }
}

// Per-realm Signal Fog. Global density is driven by live GI + how many realms
// remain; sealed realms are carved fully clear, and an unsealed realm with a
// live per-realm GI (world.realm_integrity[id]) clears proportionally. A torch
// always clears around the player. Rendered to an offscreen buffer so the
// destination-out cutouts don't erase the world beneath.
function drawFog(frame) {
  if (won) return;
  const gi = giNow();
  const unsealedFrac = realms.filter((r) => !r.sealed).length / realms.length;
  let base = 0.18 + (0.9 - gi) * 0.6 + unsealedFrac * 0.18 + 0.04 * Math.sin(frame * 0.02);
  base = Math.max(0, Math.min(0.68, base));
  if (base <= 0.01) return;
  const W = fogCanvas.width, H = fogCanvas.height;
  if (!W) return;
  const f = fctx;
  f.setTransform(1, 0, 0, 1, 0, 0);
  f.globalCompositeOperation = "source-over";
  f.clearRect(0, 0, W, H);
  f.fillStyle = `rgba(9,8,26,${base.toFixed(3)})`;
  f.fillRect(0, 0, W, H);

  f.globalCompositeOperation = "destination-out";
  const SX = (wx) => (wx - camX) * ZOOM * DPR, SY = (wy) => (wy - camY) * ZOOM * DPR;
  const punch = (cx, cy, rad, strength) => {
    const g = f.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    f.fillStyle = g; f.beginPath(); f.arc(cx, cy, rad, 0, 7); f.fill();
  };
  const rad = (REGION_R + 1) * TILE * ZOOM * DPR;
  for (const r of realms) {
    const ccx = SX(r.cx * TILE + TILE / 2), ccy = SY(r.cy * TILE + TILE / 2);
    if (ccx < -rad || ccx > W + rad || ccy < -rad || ccy > H + rad) continue;
    if (r.sealed) punch(ccx, ccy, rad, 1);
    else if (r.localGi != null) punch(ccx, ccy, rad, Math.max(0, Math.min(0.9, r.localGi)));
  }
  punch(SX(player.wx), SY(player.wy), 150 * ZOOM * DPR, 1);

  f.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(fogCanvas, 0, 0);
  ctx.restore();
}

// ================================================================
//  MMORPG LAYER (C-353): instanced maps, combat, economy, skills
// ================================================================
let instance = null;          // active instance map, or null = overworld
let combat = null;            // active combat encounter
let savedOverworldPos = null;
let overworldPortals = [];

// per-tile overlay tint cache for instance maps
const _tileCache = new Map();
function tintedTile(img, color, alpha) {
  if (!img) return null;
  const k = img.src + color + alpha;
  if (_tileCache.has(k)) return _tileCache.get(k);
  const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
  const x = cv.getContext("2d");
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = "overlay"; x.globalAlpha = alpha; x.fillStyle = color;
  x.fillRect(0, 0, cv.width, cv.height);
  _tileCache.set(k, cv); return cv;
}

// Instanced map definitions. '#'=wall '.'=floor ','=ground '~'=water 'P'=spawn
const INSTANCE_DEFS = {
  commons: {
    name: "Civic Commons", theme: "#3b82f6",
    map: [
      "###################",
      "#.................#",
      "#.................#",
      "#.................#",
      "#.................#",
      "#.................#",
      "#........P........#",
      "#.................#",
      "#.................#",
      "#.................#",
      "#.................#",
      "###################",
    ],
    entities: [
      { x: 4, y: 2, kind: "shop", name: "MIC Market", action: "market", color: "#c8a84b",
        desc: "Trade 5 MIC for a Stim that restores 40 HP." },
      { x: 9, y: 2, kind: "shop", name: "OAA Town Hall", action: "townhall", color: "#3b82f6",
        desc: "Cast a vote (1 MIC) on EPICON v2.1 to earn 40 XP." },
      { x: 14, y: 2, kind: "shop", name: "Bank of MIC", action: "bank", color: "#c8a84b",
        desc: "Collect this cycle's vault dividend." },
      { x: 6, y: 8, kind: "npc", name: "JUDAN", color: "#8cffa8", desc: "\"Participation is the reality anchor. Spend your MIC where it compounds.\"" },
      { x: 12, y: 8, kind: "npc", name: "EVE", color: "#8cffa8", desc: "\"Global synthesis complete. The Commons holds steady this cycle.\"" },
      { x: 9, y: 10, kind: "portal_back", name: "EXIT", desc: "Return to The HIVE." },
    ],
  },
  conflict: {
    name: "Conflict Zone", theme: "#ef4444",
    map: [
      "###################",
      "#,,,,,,,,,,,,,,,,,#",
      "#,,,,,,,,,,,,,,,,,#",
      "#,,,###,,,,,###,,,#",
      "#,,,,,,,,,,,,,,,,,#",
      "#,,,,,,,,P,,,,,,,,#",
      "#,,,,,,,,,,,,,,,,,#",
      "#,,,###,,,,,###,,,#",
      "#,,,,,,,,,,,,,,,,,#",
      "#,,,,,,,,,,,,,,,,,#",
      "#,,,,,,,,,,,,,,,,,#",
      "###################",
    ],
    entities: [
      { x: 5, y: 1, kind: "enemy", name: "Entropy Agent", hp: 40, reward: 5, color: "#ef4444",
        desc: "A rogue actor corrupting GI readings." },
      { x: 13, y: 2, kind: "enemy", name: "Canon Vandal", hp: 55, reward: 7, color: "#ef4444",
        desc: "Trying to overwrite the canon laws." },
      { x: 14, y: 9, kind: "enemy", name: "Cycle Drift Daemon", hp: 70, reward: 10, color: "#ef4444",
        desc: "Responsible for the cycle.json drift." },
      { x: 4, y: 9, kind: "enemy", name: "Double-Parse Bug", hp: 45, reward: 8, color: "#ef4444",
        desc: "The substrate-rejection 500. Patch it." },
      { x: 9, y: 9, kind: "boss", name: "URIEL", hp: 220, reward: 120, boss: true, color: "#a855f7",
        desc: "The truth sentinel in adversarial mode. High stakes." },
      { x: 9, y: 10, kind: "portal_back", name: "EXIT", desc: "Return to The HIVE." },
    ],
  },
};

function parseInstance(def) {
  const rows = def.map, H = rows.length, W = rows[0].length;
  const code = { "#": WALL, ".": FLOOR, ",": GROUND, "~": WATER, " ": VOID, "P": FLOOR };
  const tiles = []; let sx = 9, sy = 6;
  for (let y = 0; y < H; y++) {
    tiles[y] = [];
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x] || " ";
      tiles[y][x] = code[ch] ?? FLOOR;
      if (ch === "P") { sx = x; sy = y; }
    }
  }
  const entities = def.entities.map((e) => ({ ...e, wx: e.x * TILE + TILE / 2, wy: e.y * TILE + TILE / 2, alive: true }));
  const blocked = new Set();
  for (const e of entities) if (e.kind !== "portal_back") blocked.add(e.x + "," + e.y);
  const mc = document.createElement("canvas"); mc.width = W * TILE; mc.height = H * TILE;
  const m = mc.getContext("2d"); m.imageSmoothingEnabled = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = tiles[y][x]; if (c === VOID) continue;
    let img = IMG.floor;
    if (c === WALL) img = IMG.wall; else if (c === WATER) img = IMG.water;
    else if (c === GROUND) img = tintedTile(IMG.ground, def.theme, 0.34);
    else if (c === FLOOR) img = tintedTile(IMG.floor, def.theme, 0.22);
    if (img) m.drawImage(img, x * TILE, y * TILE);
  }
  return { def, name: def.name, theme: def.theme, tiles, W, H, blocked, entities, mapCanvas: mc, spawn: { x: sx, y: sy } };
}

function enterInstance(id) {
  const def = INSTANCE_DEFS[id]; if (!def) return;
  savedOverworldPos = { wx: player.wx, wy: player.wy, dir: player.dir };
  instance = parseInstance(def);
  player.wx = instance.spawn.x * TILE + TILE / 2;
  player.wy = instance.spawn.y * TILE + TILE / 2; player.dir = "down";
  toast("\u27f6 " + def.name); sfx("talk");
  pushChronicle({ kind: "session", text: "Entered " + def.name, cycle: liveCycle, color: def.theme });
  emitEvent("enter_map", { map: id, name: def.name });
  syncHud();
}
function exitInstance() {
  if (combat) return;
  instance = null;
  if (savedOverworldPos) { player.wx = savedOverworldPos.wx; player.wy = savedOverworldPos.wy; player.dir = savedOverworldPos.dir; }
  toast("\u27f6 The HIVE"); emitEvent("enter_map", { map: "hive", name: "The HIVE" }); syncHud();
}

function instWalk(wx, wy) {
  const I = instance; if (!I) return false;
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  if (ty < 0 || tx < 0 || ty >= I.H || tx >= I.W) return false;
  if (!WALKABLE.has(I.tiles[ty][tx])) return false;
  if (I.blocked.has(tx + "," + ty)) return false;
  return true;
}
function instTryMove(dx, dy) {
  const h = HALF;
  const nx = player.wx + dx;
  if (instWalk(nx - h, player.wy - h) && instWalk(nx + h, player.wy - h) && instWalk(nx - h, player.wy + h) && instWalk(nx + h, player.wy + h)) player.wx = nx;
  const ny = player.wy + dy;
  if (instWalk(player.wx - h, ny - h) && instWalk(player.wx + h, ny - h) && instWalk(player.wx - h, ny + h) && instWalk(player.wx + h, ny + h)) player.wy = ny;
}
function instNearest() {
  let best = null, bd = INTERACT_R * INTERACT_R;
  for (const e of instance.entities) {
    if (!e.alive) continue;
    const d = (e.wx - player.wx) ** 2 + (e.wy - player.wy) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

const INST_ACTIONS = {
  market: () => { if (spendMic(5)) { heal(40); toast("MIC Stim \u2014 +40 HP"); } else toast("Need 5 MIC"); },
  townhall: () => { if (spendMic(1)) { gainXP(40); toast("Voted on EPICON v2.1 \u2014 +40 XP"); } else toast("Need 1 MIC"); },
  bank: (e) => { if (!e._claimed) { e._claimed = true; gainMic(3); toast("Vault dividend \u2014 +3 MIC"); } else toast("Dividend already claimed this visit"); },
};

function updateInstance(cmds) {
  if (combat) return;
  let dx = 0, dy = 0;
  if (cmds.has("left")) dx -= SPEED; if (cmds.has("right")) dx += SPEED;
  if (cmds.has("up")) dy -= SPEED; if (cmds.has("down")) dy += SPEED;
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
  if (dx || dy) {
    player.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
    instTryMove(dx, dy); player.anim = Math.floor(performance.now() / 140) % 2;
  } else player.anim = 0;
  const e = instNearest();
  nearHint = !e ? "" : (e.kind === "enemy" || e.kind === "boss") ? `[E] FIGHT ${e.name}`
    : e.kind === "portal_back" ? "[E] EXIT TO THE HIVE" : `[E] ${e.name}`;
}
function interactInstance() {
  if (combat) return;
  const e = instNearest(); if (!e) return;
  if (e.kind === "portal_back") { exitInstance(); return; }
  if (e.kind === "enemy" || e.kind === "boss") { startCombat(e); return; }
  if (e.action && INST_ACTIONS[e.action]) { INST_ACTIONS[e.action](e); return; }
  openDialog(e.name, [e.desc || "\u2026"]);
}

function startCombat(e) {
  if (e.boss && player.mic < 60) { toast("URIEL demands a 60 MIC wager"); return; }
  if (e.boss) spendMic(60);
  combat = { e, eHp: e.hp, eMax: e.hp, round: 0 };
  toast("\u2694 " + e.name + " engaged"); sfx("deny");
  combat.timer = setInterval(combatRound, 700);
}
function combatRound() {
  if (!combat) return;
  combat.round++;
  const atk = 8 + Math.floor(Math.random() * 10) + player.level * 2;
  combat.eHp -= atk;
  const ret = combat.e.boss ? 10 + Math.floor(Math.random() * 16) : 4 + Math.floor(Math.random() * 8);
  const dead = damage(ret);
  toast(`You hit ${atk} \u00b7 take ${ret} \u00b7 ${combat.e.name} ${Math.max(0, combat.eHp)}/${combat.eMax}`);
  if (combat.eHp <= 0) return endCombat(true);
  if (dead) return endCombat(false);
}
function endCombat(win) {
  clearInterval(combat.timer);
  const e = combat.e; combat = null;
  if (win) {
    e.alive = false;
    const rew = e.reward || 5;
    gainMic(rew); gainXP(e.boss ? 500 : rew * 8); gainGI(e.boss ? 0.03 : 0.01);
    toast(`\u2713 ${e.name} defeated \u2014 +${rew} MIC`); sfx("seal");
    pushChronicle({ kind: "session", text: "Defeated " + e.name, cycle: liveCycle, color: "#8cffa8" });
    emitEvent("combat_win", { enemy: e.name, boss: !!e.boss });
    if (e.boss) toast("URIEL falls. Integrity restored to the network.");
  } else {
    player.hp = Math.max(20, Math.round(player.maxHp * 0.4));
    player.wx = instance.spawn.x * TILE + TILE / 2; player.wy = instance.spawn.y * TILE + TILE / 2;
    toast("Defeated \u2014 respawned at the gate"); sfx("deny"); syncHud();
  }
}

function drawInstEntity(e, frame) {
  const bob = Math.sin(frame * 0.05 + e.wx) * 2;
  if (e.kind === "enemy" || e.kind === "boss") {
    const img = tinted(IMG.sentinel, e.color, 0.5) || IMG.sentinel;
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath();
    ctx.ellipse((e.wx - camX) * ZOOM, (e.wy + 10 - camY) * ZOOM, 12 * ZOOM, 4 * ZOOM, 0, 0, 7); ctx.fill();
    blit(img, e.wx - (e.boss ? 22 : 18), e.wy - (e.boss ? 44 : 36) + bob, e.boss ? 44 : 36, e.boss ? 58 : 48);
  } else if (e.kind === "npc") {
    const img = tinted(IMG.agent, e.color || instance.theme, 0.35) || IMG.agent;
    blit(img, e.wx - 18, e.wy - 36 + bob, 36, 48);
  } else if (e.kind === "portal_back") {
    glow(e.wx, e.wy, 22, "#3dffea", frame);
    blit(IMG.shard, e.wx - 12, e.wy - 12 + bob, 24, 24);
  } else { // structure
    const im = IMG.beacon;
    if (im) ctx.drawImage(im, 32, 0, 32, 48, Math.round((e.wx - 18 - camX) * ZOOM), Math.round((e.wy - 50 - camY) * ZOOM), Math.round(36 * ZOOM), Math.round(54 * ZOOM));
    glow(e.wx, e.wy - 26, 16, e.color || instance.theme, frame);
  }
  ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  ctx.fillStyle = e.color || instance.theme;
  ctx.fillText(e.name, (e.wx - camX) * ZOOM, (e.wy - camY) * ZOOM - 42 * ZOOM);
}

function renderInstance(frame) {
  ctx.imageSmoothingEnabled = false;
  const I = instance, vwW = viewW / ZOOM, vwH = viewH / ZOOM;
  camX = Math.floor(Math.max(0, Math.min(I.W * TILE - vwW, player.wx - vwW / 2)));
  camY = Math.floor(Math.max(0, Math.min(I.H * TILE - vwH, player.wy - vwH / 2)));
  ctx.fillStyle = "#05040f"; ctx.fillRect(0, 0, viewW, viewH);
  const sw = Math.min(I.W * TILE - camX, Math.ceil(vwW) + 1), sh = Math.min(I.H * TILE - camY, Math.ceil(vwH) + 1);
  if (I.mapCanvas) ctx.drawImage(I.mapCanvas, camX, camY, sw, sh, 0, 0, sw * ZOOM, sh * ZOOM);
  const draw = [];
  for (const e of I.entities) if (e.alive) draw.push({ y: e.wy, fn: () => drawInstEntity(e, frame) });
  draw.push({ y: player.wy, fn: () => drawPlayer(frame) });
  draw.sort((a, b) => a.y - b.y);
  for (const d of draw) d.fn();
  drawHint();
}

function drawHint() {
  if (!nearHint || dialog) return;
  ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  const tw = Math.max(120, nearHint.length * 8);
  ctx.fillStyle = "rgba(11,10,31,.85)"; ctx.fillRect(viewW / 2 - tw / 2, viewH - 84, tw, 22);
  ctx.fillStyle = "#3dffea"; ctx.fillText(nearHint, viewW / 2, viewH - 69);
}

// ----------------------------------------------------------- skills
const SKILLS = [
  { key: "1", name: "ATTEST", mp: 6, fn: () => { gainGI(0.006); gainMic(0.2); toast("EPICON attest \u2014 GI rises"); } },
  { key: "2", name: "SHIELD", mp: 8, fn: () => { heal(15); toast("Integrity Shield \u2014 +15 HP"); } },
  { key: "3", name: "HEAL", mp: 16, fn: () => { heal(35); toast("Recovery \u2014 +35 HP"); } },
  { key: "4", name: "SCAN", mp: 6, fn: () => { toast(`Scan: ${instance ? instance.name : "The HIVE"} \u00b7 GI ${Math.round(giNow() * 100)}% \u00b7 LVL ${player.level}`); } },
];
const skillCd = {};
function useSkill(i) {
  const s = SKILLS[i]; if (!s) return;
  if (skillCd[i]) { toast(`${s.name} cooling`); return; }
  if (player.mp < s.mp) { toast("Not enough MP"); return; }
  player.mp -= s.mp; s.fn(); syncHud();
  skillCd[i] = true; const b = el("sk" + i); if (b) b.classList.add("cd");
  setTimeout(() => { skillCd[i] = false; const bb = el("sk" + i); if (bb) bb.classList.remove("cd"); }, 2200);
}
function buildSkillbar() {
  const bar = el("skillbar"); if (!bar) return;
  bar.innerHTML = SKILLS.map((s, i) => `<button class="sk" id="sk${i}" data-i="${i}"><span class="k">${s.key}</span>${s.name}</button>`).join("");
  bar.querySelectorAll(".sk").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); useSkill(+b.dataset.i); }));
}

function buildPortals() {
  overworldPortals = [
    { wx: wcx(HX - 3), wy: wcx(HY + 1), dest: "commons", label: "CIVIC COMMONS", color: "#3b82f6" },
    { wx: wcx(HX + 3), wy: wcx(HY + 1), dest: "conflict", label: "CONFLICT ZONE", color: "#ef4444" },
  ];
}

// ----------------------------------------------------------------- update
function update(cmds) {
  if (!started) return;
  if (dialog) return;
  if (instance) { updateInstance(cmds); return; }
  if (won) return;
  let dx = 0, dy = 0;
  if (cmds.has("left")) dx -= SPEED; if (cmds.has("right")) dx += SPEED;
  if (cmds.has("up")) dy -= SPEED; if (cmds.has("down")) dy += SPEED;
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
  if (dx || dy) {
    player.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
    tryMove(dx, dy);
    player.anim = (Math.floor(performance.now() / 140) % 2);
  } else player.anim = 0;

  // shard pickup
  for (const r of realms) {
    if (!r.revealed) continue;
    for (const s of r.shards) {
      if (s.taken) continue;
      if ((s.wx - player.wx) ** 2 + (s.wy - player.wy) ** 2 < SHARD_PICK_R ** 2) {
        s.taken = true; sfx("pick");
        const got = r.shards.filter((q) => q.taken).length;
        toast(`${STR.shards_label} ${got}/${r.total} · ${realmTitle(r.i)}`);
        if (objectivesOpen) buildObjectives();
      }
    }
  }

  const it = nearestInteractable();
  if (it) {
    if (it.type === "npc") nearHint = STR.hint_talk + " " + it.npc.name;
    else if (it.type === "portal") nearHint = "[E] ENTER " + it.portal.label;
    else if (it.type === "beacon") {
      const r = it.realm;
      nearHint = r.sealed ? STR.hint_beacon_done
        : (r.talked && r.shards.every((s) => s.taken)) ? STR.hint_beacon_ready : STR.hint_beacon_locked;
    } else nearHint = (sealedCount >= realms.length) ? STR.hint_fountain_ready : STR.hint_fountain_locked;
  } else nearHint = "";
}

function onAction() {
  if (!started) { startGame(); return; }
  if (won) { resetGame(); return; }
  if (dialog) { advanceDialog(); return; }
  doInteract();
}

function startGame() {
  started = true;
  el("intro").classList.remove("show");
  if (!actx) sfx("talk");
  emitEvent("start");
}
function resetGame() {
  el("win").classList.remove("show");
  if (combat) { clearInterval(combat.timer); combat = null; }
  instance = null; savedOverworldPos = null;
  for (const r of realms) { r.sealed = false; r.talked = false; r.revealed = false; for (const s of r.shards) s.taken = false; }
  sealedCount = 0; won = false; fountain.ready = false; fountain.active = false;
  chronicle = chronicle.filter((c) => c.kind === "history");   // keep ledger history, drop this run's deeds
  player.wx = wcx(HX); player.wy = (HY + 6) * TILE + 16; player.dir = "up";
  if (objectivesOpen) buildObjectives();
  syncHud();
}

// ------------------------------------------------------------------- loop
let last = performance.now(), acc = 0, frame = 0, paused = false;
let fpsFrames = 0, fpsAt = last, dev = new URLSearchParams(location.search).has("dev");
if (dev) el("dev").style.display = "block";
addEventListener("blur", () => paused = true);
addEventListener("focus", () => { paused = false; last = performance.now(); });

function tick(now) {
  requestAnimationFrame(tick);
  if (paused) { last = now; return; }
  acc += now - last; last = now;
  if (acc > 250) acc = 250;
  const cmds = commands();
  const aPressed = cmds.has("action");
  const actionEdge = pendingAction || (aPressed && !prevAction);
  prevAction = aPressed; pendingAction = false;
  while (acc >= STEP) { update(cmds); acc -= STEP; }
  if (actionEdge) onAction();
  frame++;
  if (started && frame % 24 === 0 && player.mp < player.maxMp) { player.mp = Math.min(player.maxMp, player.mp + 1); syncHud(); }
  if (toastT > 0 && --toastT === 0) el("toast").classList.remove("show");
  render(frame);
  if (dev) {
    fpsFrames++;
    if (now - fpsAt >= 500) {
      el("dev").textContent = Math.round(fpsFrames * 1000 / (now - fpsAt)) + " fps · sealed " + sealedCount;
      fpsFrames = 0; fpsAt = now;
    }
  }
}

// --------------------------------------------------------- live data overlay
async function tryLive() {
  const u = new URL(location.href);
  const dataBase = u.searchParams.get("data");
  const candidates = [];
  if (dataBase) candidates.push(dataBase.replace(/\/$/, "") + "/current-world.json", dataBase.replace(/\/$/, "") + "/world/current-world.json");
  candidates.push("./world/current-world.json", "../../world/current-world.json");
  for (const c of candidates) {
    try {
      const res = await fetch(c, { cache: "no-store" });
      if (!res.ok) continue;
      const w = await res.json();
      if (w && w.cycle) {
        liveCycle = w.cycle; live = true;
        if (w.integrity && typeof w.integrity.gi === "number") giBase = Math.max(0, Math.min(1, w.integrity.gi));
        if (w.vault && typeof w.vault.progress === "number") vaultBase = Math.max(0, Math.min(1, w.vault.progress));
        // optional per-realm GI for zone-level fog (future-proof; absent today)
        const ri = w.realm_integrity || w.realm_gi || null;
        if (ri) for (const r of realms) { const g = ri[r.def.id]; if (typeof g === "number") r.localGi = Math.max(0, Math.min(1, g)); }
        // seed Chronicle from live citizen_history
        if (Array.isArray(w.citizen_history) && w.citizen_history.length) {
          for (const e of w.citizen_history.slice(-20)) chronicle.push({ kind: "history", text: formatHistory(e), cycle: e?.cycle || w.cycle });
        }
        if (objectivesOpen) buildObjectives();
        syncHud();
        return;
      }
    } catch (e) { /* offline / cross-origin -> snapshot */ }
  }
}

// ------------------------------------------------------------------- boot
function boot() {
  buildWorld();
  buildMapCanvas();
  buildPortals();
  buildSkillbar();
  bindTouch();
  resize();
  // intro copy
  el("introsub").textContent = STR.subtitle;
  el("introtitle").textContent = STR.title;
  el("introp").textContent = `${WORLD_SNAPSHOT.event.title}: ${WORLD_SNAPSHOT.event.description} ` +
    `${WORLD_SNAPSHOT.quest.title} — sweep integrity shards and light each realm's beacon to lift the fog.`;
  el("introcta").textContent = STR.start;
  el("introhint").textContent = STR.start_hint;
  syncHud();
  if (dev) window.__hive = { realms, npcs, player, fountain, sealRealm, winGame,
    enterInstance, exitInstance, startCombat, useSkill, gainXP,
    instance: () => instance, combat: () => combat,
    isReachable: (tx, ty) => reachableSet.has(tx + "," + ty),
    state: () => ({ sealedCount, won, gi: giNow(), mic: micNow(), live, level: player.level, hp: player.hp, mp: player.mp, map: instance ? instance.name : "hive" }) };
  requestAnimationFrame(tick);
  // Emit `ready` only after the live overlay settles so the parent records the
  // same live cycle/GI/vault the HUD shows (a safety timeout fires it regardless
  // if the network stalls). (Codex P2)
  let readyEmitted = false;
  const emitReadyOnce = () => { if (!readyEmitted) { readyEmitted = true; emitEvent("ready"); } };
  tryLive().then(emitReadyOnce, emitReadyOnce);
  setTimeout(emitReadyOnce, 4000);
}

loadAssets().then(boot);
