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
  floor: "floor.png", scout: "scout.png", agent: "agent.png", shard: "shard.png",
  beacon: "beacon.png", tree: "tree.png", fountain: "fountain.png",
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
      if (ocean) setTile(x, y, (dx * dx + dy * dy <= 4) ? GROUND : WATER);
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

  // realm runtime objects: agent, beacon, shards
  realms = centers.map(({ def, i, cx, cy }) => {
    const color = def.color;
    const beaconT = { x: cx, y: cy - 2 };
    if (map[beaconT.y] && WALKABLE.has(map[beaconT.y][beaconT.x] ?? VOID) === false) beaconT.y = cy - 1;
    blockedObj.add(tkey(beaconT.x, beaconT.y));
    const agentT = { x: cx, y: cy + 1 };
    blockedObj.add(tkey(agentT.x, agentT.y));

    // shards on walkable, unblocked tiles in ring 2..4
    const shards = [];
    let guard = 0;
    while (shards.length < SHARDS_PER_REALM && guard++ < 400) {
      const a = rand() * Math.PI * 2;
      const r = 2 + rand() * 2.4;
      const sx = Math.round(cx + Math.cos(a) * r);
      const sy = Math.round(cy + Math.sin(a) * r);
      if (!inBounds(sx, sy) || !WALKABLE.has(map[sy][sx]) || blockedObj.has(tkey(sx, sy))) continue;
      if (shards.some((s) => Math.abs(s.tx - sx) + Math.abs(s.ty - sy) < 2)) continue;
      shards.push({ tx: sx, ty: sy, wx: wcx(sx), wy: wcx(sy), taken: false });
    }

    const ag = WORLD_SNAPSHOT.agents[def.agent] || { name: def.agent.toUpperCase(), role: "", lines: [def.blurb] };
    npcs.push({ id: def.agent, kind: "agent", name: ag.name, role: ag.role, lines: ag.lines,
      wx: wcx(agentT.x), wy: wcx(agentT.y), color, realm: i });

    return { def, i, cx, cy, color, beacon: { ...beaconT, wx: wcx(beaconT.x), wy: wcx(beaconT.y) },
      shards, talked: false, sealed: false, total: SHARDS_PER_REALM };
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
}

// ----------------------------------------------------------------- state
const player = { wx: wcx(HX), wy: (HY + 6) * TILE + 16, dir: "up", step: 0, anim: 0 };
let sealedCount = 0;
let won = false;
let started = false;
let live = false;
let liveCycle = WORLD_SNAPSHOT.cycle;
let dialog = null, dialogLine = 0;
let nearHint = "";
const 
  el = (id) => document.getElementById(id);

// integrity/vault baselines — overridden by live current-world.json when found,
// then gameplay (sealing realms) raises them toward 1.0
let giBase = GI_BASE;
let vaultBase = WORLD_SNAPSHOT.vault.progress;
function giNow() { return Math.min(1, giBase + (sealedCount / realms.length) * (1 - giBase)); }
function vaultNow() { return Math.min(1, vaultBase + (sealedCount / realms.length) * (1 - vaultBase)); }
function micNow() { return Math.round(1000 + vaultNow() * 337); }

// ------------------------------------------------------------------- audio
let actx = null;
function sfx(type) {
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
  const c = BIND[e.code]; if (!c) { if (e.code === "Escape") closeAll(); return; }
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
  if (fd < (INTERACT_R + 14) ** 2 && fd < bestD) best = { type: "fountain" };
  return best;
}

function realmTitle(i) { return realmDefs[i].title; }

function doInteract() {
  const it = nearestInteractable();
  if (!it) return;
  if (it.type === "npc") {
    const npc = it.npc;
    let lines = npc.lines.slice();
    if (npc.kind === "agent" && npc.realm != null) {
      const r = realms[npc.realm];
      if (!r.sealed) {
        if (!r.talked) { r.talked = true; revealShards(r); }
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
  if (sealedCount >= realms.length) { fountain.ready = true; toast(STR.fountain_unlocked); }
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

function syncHud() {
  const gi = Math.round(giNow() * 100);
  const tag = live ? `<span class="aqua pill">${STR.hud_live}</span>` : `<span class="muted pill">${STR.hud_demo}</span>`;
  el("hud").innerHTML = `
    <span class="gold pill">${STR.title}</span>
    <span class="gold pill">${STR.hud_cycle} ${liveCycle}</span>
    <span class="green pill">${STR.hud_mic} ${micNow()}</span>
    <span class="green pill">${STR.hud_gi} ${gi}%</span>
    <span class="aqua pill">${STR.hud_realms} ${sealedCount}/${realms.length}</span>
    <span class="${won ? "green" : "red"} pill">${STR.hud_event} ${won ? "CLEAR" : WORLD_SNAPSHOT.event.title}</span>
    ${tag}`;
}

// ---------------------------------------------------------------- render
const canvas = el("c"), ctx = canvas.getContext("2d");
let camX = 0, camY = 0;
let viewW = 0, viewH = 0;
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
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
  // camera
  const vwW = viewW / ZOOM, vwH = viewH / ZOOM;
  camX = Math.max(2 * TILE, Math.min(MAP_W * TILE - 2 * TILE - vwW, player.wx - vwW / 2));
  camY = Math.max(2 * TILE, Math.min(MAP_H * TILE - 2 * TILE - vwH, player.wy - vwH / 2));

  ctx.fillStyle = "#05040f";
  ctx.fillRect(0, 0, viewW, viewH);

  const x0 = Math.max(0, Math.floor(camX / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((camX + vwW) / TILE));
  const y0 = Math.max(0, Math.floor(camY / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((camY + vwH) / TILE));

  // ground / tiles
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = map[y][x];
    if (c === VOID) continue;
    let img = IMG.ground;
    if (c === PATH) img = IMG.path; else if (c === WATER) img = IMG.water;
    else if (c === WALL) img = IMG.wall; else if (c === FLOOR) img = IMG.floor;
    blit(img, x * TILE, y * TILE, TILE, TILE);
    // realm tint on ground
    if (c === GROUND) {
      const ri = realmAt[y][x];
      if (ri >= 0) {
        ctx.globalAlpha = 0.22; ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = realms[ri].color;
        ctx.fillRect(Math.round((x * TILE - camX) * ZOOM), Math.round((y * TILE - camY) * ZOOM), TILE * ZOOM + 1, TILE * ZOOM + 1);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }
    }
  }

  // collect drawables (y-sorted)
  const draw = [];
  for (const t of trees) draw.push({ y: t.wy, fn: () => blit(IMG.tree, t.wx - 20, t.wy - 48, 40, 60) });
  for (const r of realms) {
    const cell = r.sealed ? 1 : 0;
    draw.push({ y: r.beacon.wy, fn: () => {
      const im = IMG.beacon;
      if (im) ctx.drawImage(im, cell * 32, 0, 32, 48,
        Math.round((r.beacon.wx - 18 - camX) * ZOOM), Math.round((r.beacon.wy - 50 - camY) * ZOOM),
        Math.round(36 * ZOOM), Math.round(54 * ZOOM));
      if (r.sealed) glow(r.beacon.wx, r.beacon.wy - 28, 26, r.color, frame);
    } });
    for (const s of r.shards) {
      if (s.taken || !r.revealed) continue;
      const bob = Math.sin(frame * 0.06 + s.wx) * 3;
      draw.push({ y: s.wy, fn: () => { glow(s.wx, s.wy + bob, 12, "#3dffea", frame); blit(IMG.shard, s.wx - 12, s.wy - 12 + bob, 24, 24); } });
    }
  }
  // fountain
  draw.push({ y: fountain.wy, fn: () => {
    const im = IMG.fountain, cell = fountain.active ? 1 : 0;
    if (im) ctx.drawImage(im, cell * 48, 0, 48, 48,
      Math.round((fountain.wx - 32 - camX) * ZOOM), Math.round((fountain.wy - 44 - camY) * ZOOM),
      Math.round(64 * ZOOM), Math.round(64 * ZOOM));
    if (fountain.active) glow(fountain.wx, fountain.wy - 16, 40, "#e8c547", frame);
    else if (fountain.ready) glow(fountain.wx, fountain.wy - 16, 30, "#3dffea", frame);
  } });
  // npcs
  for (const npc of npcs) draw.push({ y: npc.wy, fn: () => drawNpc(npc, frame) });
  // player
  draw.push({ y: player.wy, fn: () => drawPlayer(frame) });

  draw.sort((a, b) => a.y - b.y);
  for (const d of draw) d.fn();

  // signal fog
  drawFog(frame);

  // nearby hint
  if (nearHint && !dialog) {
    ctx.fillStyle = "rgba(11,10,31,.85)";
    const w = ctx.measureText(nearHint).width;
    ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = "center";
    const tw = Math.max(120, nearHint.length * 8);
    ctx.fillRect(viewW / 2 - tw / 2, viewH - 84, tw, 22);
    ctx.fillStyle = "#3dffea";
    ctx.fillText(nearHint, viewW / 2, viewH - 69);
  }
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
  const img = tinted(IMG.agent, npc.color, 0.5) || IMG.agent;
  blit(img, npc.wx - 16, npc.wy - 40 + bob, 32, 48);
  // nameplate
  ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = "center";
  ctx.fillStyle = "rgba(11,10,31,.7)";
  const sx = (npc.wx - camX) * ZOOM, sy = (npc.wy - camY) * ZOOM;
  ctx.fillStyle = npc.color; ctx.fillText(npc.name, sx, sy - 52 * ZOOM / ZOOM - 6);
}

function drawPlayer(frame) {
  const frames = { down: 0, up: 2, left: 4, right: 6 };
  const base = frames[player.dir] ?? 0;
  const f = base + (player.anim ? 1 : 0);
  const im = IMG.scout;
  const dx = Math.round((player.wx - 16 - camX) * ZOOM), dy = Math.round((player.wy - 22 - camY) * ZOOM);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.ellipse((player.wx - camX) * ZOOM, (player.wy + 12 - camY) * ZOOM, 11 * ZOOM, 4 * ZOOM, 0, 0, 7); ctx.fill();
  if (im) ctx.drawImage(im, f * 16, 0, 16, 16, dx, dy, 32 * ZOOM, 32 * ZOOM);
}

function drawFog(frame) {
  const sealedFrac = sealedCount / realms.length;
  const base = won ? 0.0 : 0.42 * (1 - sealedFrac * 0.8);
  if (base <= 0.01) return;
  const drift = 0.06 * Math.sin(frame * 0.02);
  const px = (player.wx - camX) * ZOOM, py = (player.wy - camY) * ZOOM;
  const r = 150 * ZOOM;
  const g = ctx.createRadialGradient(px, py, r * 0.35, px, py, r);
  g.addColorStop(0, "rgba(8,8,26,0)");
  g.addColorStop(1, `rgba(8,8,26,${(base + drift).toFixed(3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = `rgba(10,10,30,${(base * 0.5).toFixed(3)})`;
  ctx.fillRect(0, 0, viewW, viewH);
}

// ----------------------------------------------------------------- update
function update(cmds) {
  if (!started || won) return;
  if (dialog) { return; }
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
      }
    }
  }

  const it = nearestInteractable();
  if (it) {
    if (it.type === "npc") nearHint = STR.hint_talk + " " + it.npc.name;
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
}
function resetGame() {
  el("win").classList.remove("show");
  for (const r of realms) { r.sealed = false; r.talked = false; r.revealed = false; for (const s of r.shards) s.taken = false; }
  sealedCount = 0; won = false; fountain.ready = false; fountain.active = false;
  player.wx = wcx(HX); player.wy = (HY + 6) * TILE + 16; player.dir = "up";
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
        syncHud();
        return;
      }
    } catch (e) { /* offline / cross-origin -> snapshot */ }
  }
}

// ------------------------------------------------------------------- boot
function boot() {
  buildWorld();
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
  tryLive();
  if (dev) window.__hive = { realms, npcs, player, fountain, sealRealm, winGame,
    state: () => ({ sealedCount, won, gi: giNow(), mic: micNow() }) };
  requestAnimationFrame(tick);
}

loadAssets().then(boot);
