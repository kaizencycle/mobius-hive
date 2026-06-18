/**
 * C-346 PERF-10: bake-snapshot.mjs
 *
 * Reads world/current-world.json and world/current-cycle.json and writes
 * artifacts/hive-world-simulator/world-snapshot.js with up-to-date values.
 *
 * Run: node scripts/world/bake-snapshot.mjs
 * CI:  Wired into world-update.yml after build-world-state.js
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SNAPSHOT_PATH = path.join(ROOT, "artifacts", "hive-world-simulator", "world-snapshot.js");

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

const world = readJson(path.join(ROOT, "world", "current-world.json"));
const cycleData = readJson(path.join(ROOT, "world", "current-cycle.json"));
const sentinels = readJson(path.join(ROOT, "world", "sentinels", "zeus.json"), {});

const cycle = world.cycle || cycleData.cycle_id || "C-?";
const updatedAt = new Date().toISOString();
const gi = world.integrity?.gi ?? 0.63;
const kvStatus = world.integrity?.kv_status ?? "unknown";
const sourceMode = world.integrity?.source_mode ?? "kv_preferred";
const vaultProgress = world.vault?.progress ?? 0;
const fountainStatus = world.vault?.fountain_status ?? "locked";
const worldMood = world.world_mood ?? "fogged";
const activeEvents = world.active_events ?? [];
const activeQuests = world.active_quests ?? [];
const activeSentinels = world.active_sentinels ?? ["zeus", "jade", "hermes"];
const citizenHistory = (world.citizen_history ?? []).slice(-10);

// Read the existing file to preserve non-world-state exports (STR, realms, etc.)
const existing = fs.existsSync(SNAPSHOT_PATH) ? fs.readFileSync(SNAPSHOT_PATH, "utf8") : "";

// Extract the block after WORLD_SNAPSHOT closing brace to preserve STR/realms exports
const afterSnapshotMatch = existing.match(/^(export const WORLD_SNAPSHOT[\s\S]*?^};)/m);
const afterBlock = afterSnapshotMatch
  ? existing.slice(existing.indexOf(afterSnapshotMatch[0]) + afterSnapshotMatch[0].length)
  : "";

const header = `/**
 * Mobius HIVE — baked world snapshot (cycle ${cycle}, auto-baked by bake-snapshot.mjs).
 *
 * This is a frozen projection of the live \`world/*.json\` contracts in the
 * mobius-hive repo, embedded so the deployed game is fully self-contained.
 * When served from the repo root (or with \`?data=<base>\`), \`game.js\` will
 * try to fetch the live \`world/current-world.json\` and overlay it on top of
 * this snapshot — so the simulator stays accurate as the cycle advances.
 *
 * Re-baked: ${updatedAt}
 */
`;

const snapshotBlock = `export const WORLD_SNAPSHOT = {
  cycle: ${JSON.stringify(cycle)},
  updated_at: ${JSON.stringify(updatedAt)},
  world_mood: ${JSON.stringify(worldMood)},
  integrity: { gi: ${gi}, kv_status: ${JSON.stringify(kvStatus)}, source_mode: ${JSON.stringify(sourceMode)} },
  vault: { progress: ${vaultProgress}, fountain_status: ${JSON.stringify(fountainStatus)} },
  active_events: ${JSON.stringify(activeEvents)},
  active_quests: ${JSON.stringify(activeQuests)},
  active_sentinels: ${JSON.stringify(activeSentinels)},
  citizen_history: ${JSON.stringify(citizenHistory, null, 2).replace(/^/gm, "  ").trim()},
`;

// Preserve everything after the opening of WORLD_SNAPSHOT (event, quest, realm_integrity blocks)
// Find the section from `event:` to the closing `};`
const existingContentMatch = existing.match(/(\s+event:\s*\{[\s\S]*?^};)/m);
const preservedContent = existingContentMatch ? existingContentMatch[0] : "\n};\n";

const output = header + "\n" + snapshotBlock + preservedContent + afterBlock;
fs.writeFileSync(SNAPSHOT_PATH, output, "utf8");
console.log(`[bake-snapshot] wrote ${SNAPSHOT_PATH} (cycle=${cycle}, gi=${gi}, vault=${vaultProgress})`);
