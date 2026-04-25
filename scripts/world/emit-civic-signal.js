import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const WORLD = path.join(ROOT, "world");
const LEDGER = path.join(ROOT, "ledger");

function readJson(rel, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(rel, payload) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function withProof(payload, eventType, cycle, workflowId = "world-update") {
  const sourceHash = sha256(stableStringify(payload));
  return {
    ...payload,
    source_hash: sourceHash,
    idempotency_key: `mobius-hive:${eventType}:${cycle}:${sourceHash.slice(0, 16)}:${workflowId}`,
  };
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickWorldPressure(currentCycle, currentWorld, event) {
  const eventId = currentCycle?.active_event_id ?? event?.id;
  const mood = currentWorld?.world_mood;
  const gi = currentCycle?.signals?.gi ?? currentWorld?.integrity?.gi;
  const kvStatus = currentCycle?.signals?.kv_status ?? currentWorld?.integrity?.kv_status;

  if (eventId === "signal-fog" || kvStatus === "degraded" || mood === "fogged") return "elevated";
  if (eventId === "fountain-murmur" || mood === "resonant") return "rising";
  if (typeof gi === "number" && gi < 0.8) return "watch";
  return "nominal";
}

function recommendationFor(pressure) {
  if (pressure === "elevated") return "Prioritize ZEUS verification and lane recovery before canon promotion.";
  if (pressure === "rising") return "Prepare proof anchors and monitor seal readiness.";
  if (pressure === "watch") return "Keep ECHO/HERMES monitoring active and prevent stale world state from becoming canon.";
  return "Continue patrol and log quiet-grid stability.";
}

function main() {
  const currentCycle = readJson("world/current-cycle.json", {});
  const currentWorld = readJson("world/current-world.json", {});
  const cycle = firstString(currentCycle?.cycle_id, currentCycle?.cycle, currentWorld?.cycle) ?? "C-—";
  const generatedAt = new Date().toISOString();

  const eventId = firstString(currentCycle?.active_event_id, currentWorld?.active_events?.[0]);
  const questId = firstString(currentCycle?.active_quest_id, currentWorld?.active_quests?.[0]);
  const sentinelId = firstString(currentCycle?.active_sentinel_id, currentCycle?.assigned_sentinel_id);

  const activeEvent = eventId ? readJson(`world/events/${eventId}.json`, { id: eventId }) : null;
  const activeQuest = questId ? readJson(`world/quests/${questId}.json`, { id: questId }) : null;
  const activeSentinel = sentinelId ? readJson(`world/sentinels/${sentinelId}.json`, { id: sentinelId }) : null;
  const ledgerWorldExisting = readJson("ledger/hive-world-state.json", {});

  const worldPressure = pickWorldPressure(currentCycle, currentWorld, activeEvent);
  const civicSignalBase = {
    schema: "QUEST_SIGNAL_V1",
    node_id: "mobius-hive",
    event_type: "QUEST_SIGNAL_V1",
    workflow_id: "world-update",
    generated_at: generatedAt,
    cycle,
    world_pressure: worldPressure,
    gi: currentCycle?.signals?.gi ?? currentWorld?.integrity?.gi ?? null,
    kv_status: currentCycle?.signals?.kv_status ?? currentWorld?.integrity?.kv_status ?? "unknown",
    source_mode: currentWorld?.integrity?.source_mode ?? "world_projection",
    rules_fired: Array.isArray(currentCycle?.rules_fired) ? currentCycle.rules_fired : [],
    active_event: activeEvent,
    active_quest: activeQuest,
    active_sentinel: activeSentinel,
    recommendation: recommendationFor(worldPressure),
    canon_rule: "HIVE may simulate world pressure and civic meaning. Canon still requires human merge.",
  };
  const civicSignal = withProof(civicSignalBase, "QUEST_SIGNAL_V1", cycle);

  const worldPulseBase = {
    schema: "HIVE_WORLD_PULSE_V1",
    node_id: "mobius-hive",
    event_type: "HIVE_WORLD_PULSE_V1",
    workflow_id: "world-update",
    generated_at: generatedAt,
    cycle,
    current_cycle: currentCycle,
    current_world: currentWorld,
    world: {
      active_event: activeEvent,
      active_quest: activeQuest,
      active_sentinel: activeSentinel,
    },
    civic_signal: {
      world_pressure: civicSignal.world_pressure,
      recommendation: civicSignal.recommendation,
      rules_fired: civicSignal.rules_fired,
    },
    route: [
      "HIVE_WORLD_STATE",
      "HIVE_WORLD_PULSE",
      "BROWSER_SHELL_SURFACE",
      "TERMINAL_BIG_PULSE",
      "SUBSTRATE_MEMORY",
      "CIVIC_LEDGER_PROOF",
    ],
  };
  const worldPulse = withProof(worldPulseBase, "HIVE_WORLD_PULSE_V1", cycle);

  const ledgerWorldBase = {
    schema: "WORLD_STATE_V1",
    node_id: "mobius-hive",
    event_type: "WORLD_STATE_V1",
    workflow_id: "world-update",
    cycle_id: cycle,
    updated_at: generatedAt,
    previous_ledger_shape: ledgerWorldExisting,
    hive: {
      active_event: activeEvent,
      active_quest: activeQuest,
      active_sentinel: activeSentinel,
    },
    civic_signal: civicSignal,
  };
  const ledgerWorld = withProof(ledgerWorldBase, "WORLD_STATE_V1", cycle);

  writeJson("world/civic-signal.json", civicSignal);
  writeJson("world/hive-world-pulse.json", worldPulse);
  writeJson("ledger/hive-world-state.json", ledgerWorld);

  fs.mkdirSync(LEDGER, { recursive: true });
  console.log(`mobius-hive: emitted civic signal packets for ${cycle} (${worldPressure})`);
}

main();
