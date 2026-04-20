import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const WORLD_CYCLE = path.join(ROOT, "world", "current-cycle.json");
const OUT_DIR = path.join(ROOT, "ledger", "quest-proposals");
const OUT_FILE = path.join(OUT_DIR, "latest.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function main() {
  if (!fs.existsSync(WORLD_CYCLE)) {
    console.error("mobius-hive: missing world/current-cycle.json — run build-world-state first");
    process.exitCode = 1;
    return;
  }

  const cycle = readJson(WORLD_CYCLE);
  const proposal = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    cycle_id: cycle.cycle_id,
    title: `Quest drift check — ${cycle.cycle_id}`,
    summary:
      "Automated sentinel proposal from current HIVE world tick. Intended for review-only PRs.",
    suggested_branch: `cursor/hive-quest-${cycle.cycle_id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    files_to_touch: [
      "world/quests/",
      "world/events/",
      "docs/game/player_loops.md",
    ],
    governance: {
      merge_requires: ["ZEUS", "ATLAS"],
      auto_merge: false,
    },
    context: {
      rules_fired: cycle.rules_fired,
      active_quest_id: cycle.active_quest_id,
      active_event_id: cycle.active_event_id,
      active_sentinel_id: cycle.active_sentinel_id,
      signals: cycle.signals,
      ingest_health: cycle.ingest_health,
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(proposal, null, 2)}\n`, "utf8");
  console.log(`mobius-hive: wrote ${path.relative(ROOT, OUT_FILE)}`);
}

main();
