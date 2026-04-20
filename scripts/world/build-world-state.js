import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const IN_DIR = path.join(ROOT, "ledger", "inputs");
const WORLD = path.join(ROOT, "world");

/** C-290 HIVE Sims — static bios + UI contract (cycle timestamps refreshed each build). */
const SIM_SENTINELS = {
  zeus: {
    id: "zeus",
    title: "Sentinel of Integrity",
    role: "integrity",
    mood: "alert",
    location: "castle",
    dialogue: {
      default: "The signal is unstable.",
      inspect_pending: "The Beacon has not been examined.",
      fallback_pending: "You see the fracture. Now stabilize it.",
      complete: "The signal stabilizes. The fog recedes.",
    },
    abilities: ["warn", "open_integrity_quest", "gate_unsafe_actions"],
  },
  jade: {
    id: "jade",
    title: "Sentinel of Reflection",
    role: "narrative",
    mood: "reflective",
    location: "castle",
    dialogue: {
      default: "The chamber remembers.",
      fog: "Even in fog, the record persists.",
    },
    abilities: ["annotate", "summarize_cycle"],
  },
  hermes: {
    id: "hermes",
    title: "Sentinel of Flow",
    role: "economy",
    mood: "watching",
    location: "castle",
    dialogue: {
      default: "Movement gathers near the Fountain.",
      vault_rising: "Flow strengthens; keep it steady.",
    },
    abilities: ["signal_economy", "prepare_fountain"],
  },
};

const SIM_ZONE_CASTLE = {
  id: "castle",
  title: "Castle",
  description: "Central chamber of oversight and coordination.",
  features: ["sentinel_rail", "event_overlay", "quest_panel"],
  default_overlay: "clear",
};

const SIM_EVENT_SPECS = {
  "signal-fog": {
    id: "signal-fog",
    type: "integrity_event",
    severity: "medium",
    title: "Signal Fog",
    description:
      "The lattice is visible, but unstable. Memory remains, live sight fades.",
    trigger: { kv_status: "degraded", gi_below: 0.8 },
    sentinel_owner: "zeus",
    ui: { overlay: "fog", color: "dim", priority: 1 },
  },
  "fountain-murmur": {
    id: "fountain-murmur",
    type: "integrity_event",
    severity: "low",
    title: "Fountain Murmur",
    description: "The vault deepens and integrity rises; the city hears water again.",
    sentinel_owner: "hermes",
    ui: { overlay: "shimmer", color: "warm", priority: 2 },
  },
  "quiet-grid": {
    id: "quiet-grid",
    type: "calm_event",
    severity: "low",
    title: "Quiet Grid",
    description: "No mesh alarms fired on this tick.",
    sentinel_owner: "atlas",
    ui: { overlay: "clear", color: "neutral", priority: 0 },
  },
};

const SIM_QUEST_SPECS = {
  "restore-the-beacon": {
    id: "restore-the-beacon",
    type: "stability_quest",
    title: "Restore the Beacon",
    description: "Re-establish live signal continuity across the Castle.",
    assigned_by: "zeus",
    status: "active",
    progress: 0,
    steps: [
      { id: "inspect", label: "Inspect Beacon", completed: false },
      { id: "fallback", label: "Verify Fallback Path", completed: false },
      { id: "ack", label: "Acknowledge Sentinel", completed: false },
    ],
    reward_preview: {
      vault_effect: "stability_credit",
      mic_effect: "none_until_eligible",
    },
  },
  "prepare-the-seal": {
    id: "prepare-the-seal",
    type: "governance_quest",
    title: "Prepare the Seal",
    description: "Align proofs and ledger anchors before the next cycle boundary.",
    assigned_by: "hermes",
    status: "active",
    progress: 0,
    steps: [
      { id: "gather", label: "Gather proofs", completed: false },
      { id: "align", label: "Align anchors", completed: false },
    ],
    reward_preview: { vault_effect: "seal_readiness", mic_effect: "none_until_eligible" },
  },
  "patrol-the-lanes": {
    id: "patrol-the-lanes",
    type: "vigil_quest",
    title: "Patrol the Lanes",
    description: "Keep watch: terminal heartbeat, pulse freshness, OAA seals.",
    assigned_by: "atlas",
    status: "active",
    progress: 0,
    steps: [
      { id: "heartbeat", label: "Log heartbeat", completed: false },
      { id: "freshness", label: "Check pulse freshness", completed: false },
    ],
    reward_preview: { vault_effect: "none", mic_effect: "none_until_eligible" },
  },
};

const SENTINEL_ATLAS_SIM = {
  id: "atlas",
  title: "Sentinel of Verification",
  role: "verification",
  mood: "calm",
  location: "castle",
  dialogue: {
    default: "No drama is also data. Log the null result.",
  },
  abilities: ["verify_null", "log_quiet_grid"],
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function unwrapEnvelope(payload) {
  if (!payload?.ok) return null;
  const d = payload.data;
  if (d && typeof d === "object" && "data" in d) return d.data;
  return d;
}

function pickKvStatus(terminalPayload, cycleStatePayload, oaaPayload) {
  const t = terminalPayload?.ok ? terminalPayload.data : null;
  const c = unwrapEnvelope(cycleStatePayload) ?? (cycleStatePayload?.ok ? cycleStatePayload.data : null);
  const o = oaaPayload?.ok ? oaaPayload.data : null;
  const direct =
    c?.kv_status ??
    c?.kv?.status ??
    c?.lanes?.kv?.status ??
    t?.kv_status ??
    t?.kv?.status ??
    t?.status?.kv ??
    o?.kv_status ??
    o?.status ??
    null;
  if (typeof direct === "string") return direct.toLowerCase();
  if (c?.degraded === true || t?.degraded === true) return "degraded";
  if (t?.lanes?.kv && t.lanes.kv.ok === false) return "degraded";
  return "unknown";
}

function pickGi(pulsePayload, cycleStatePayload, terminalPayload) {
  const p = pulsePayload?.ok ? pulsePayload.data : null;
  const c = unwrapEnvelope(cycleStatePayload) ?? (cycleStatePayload?.ok ? cycleStatePayload.data : null);
  const t = terminalPayload?.ok ? terminalPayload.data : null;
  const gi =
    p?.terminal_snapshot?.gi ??
    p?.global_integrity?.score ??
    p?.gi ??
    c?.gi ??
    c?.global_integrity?.score ??
    c?.lanes?.integrity?.gi ??
    t?.gi ??
    t?.lanes?.integrity?.gi ??
    p?.network_mii ??
    p?.integrity?.global ??
    p?.mesh?.gi ??
    null;
  if (typeof gi === "number") return gi;
  if (typeof gi === "string") {
    const n = Number(gi);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickVaultProgress(terminalPayload, cycleStatePayload, oaaPayload) {
  const t = terminalPayload?.ok ? terminalPayload.data : null;
  const c = unwrapEnvelope(cycleStatePayload) ?? (cycleStatePayload?.ok ? cycleStatePayload.data : null);
  const o = oaaPayload?.ok ? oaaPayload.data : null;
  const v =
    c?.vault_progress ??
    c?.vault?.progress ??
    t?.vault_progress ??
    t?.vault?.progress ??
    t?.lanes?.pulse?.composite ??
    t?.lanes?.signals?.composite ??
    o?.vault_progress ??
    o?.vault?.progress ??
    null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickCycleId(cycleStatePayload, pulsePayload, terminalPayload) {
  const c = unwrapEnvelope(cycleStatePayload) ?? (cycleStatePayload?.ok ? cycleStatePayload.data : null);
  const p = pulsePayload?.ok ? pulsePayload.data : null;
  const t = terminalPayload?.ok ? terminalPayload.data : null;
  const id =
    c?.cycle_id ??
    c?.cycle?.id ??
    c?.cycle ??
    p?.cycle?.id ??
    p?.cycle ??
    p?.current_cycle ??
    p?.cycle_id ??
    p?.mesh?.cycle_id ??
    t?.cycle ??
    t?.lanes?.echo?.cycle ??
    null;
  if (typeof id === "string" && id.trim()) return id.trim();
  return "C-290";
}

function pickSourceMode(kvStatus, terminalPayload, cycleStatePayload, oaaPayload) {
  const tOk = Boolean(terminalPayload?.ok);
  const oOk = Boolean(oaaPayload?.ok);
  const cOk = Boolean(cycleStatePayload?.ok);
  if (kvStatus === "degraded" && oOk) return "verified_memory";
  if (tOk && oOk) return "kv_with_memory_fallback";
  if (tOk) return "kv_preferred";
  if (oOk) return "verified_memory";
  if (cOk) return "ledger_cycle_bridge";
  return "unavailable";
}

function pickWorldMood(kvStatus, gi, rules) {
  if (kvStatus === "degraded") return "fogged";
  if (typeof gi === "number" && gi < 0.8) return "fogged";
  if (rules.includes("vault_rising_and_gi")) return "resonant";
  return "stable";
}

function pickFountainStatus(rules) {
  if (rules.includes("vault_rising_and_gi")) return "stirring";
  return "locked";
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function buildRichEvent(activeEvent, cycleId, updatedAt) {
  const spec = SIM_EVENT_SPECS[activeEvent.id];
  if (!spec) {
    return {
      ...activeEvent,
      cycle_id: cycleId,
      updated_at: updatedAt,
    };
  }
  return {
    ...spec,
    tone: activeEvent.tone,
    summary: activeEvent.summary,
    cycle_id: cycleId,
    updated_at: updatedAt,
  };
}

function buildRichQuest(activeQuest, sentinelId, cycleId, updatedAt) {
  const spec = SIM_QUEST_SPECS[activeQuest.id];
  if (!spec) {
    return {
      ...activeQuest,
      cycle_id: cycleId,
      updated_at: updatedAt,
      sentinel_id: sentinelId,
    };
  }
  const q = clone(spec);
  q.cycle_id = cycleId;
  q.updated_at = updatedAt;
  q.sentinel_id = sentinelId;
  return q;
}

function buildRichSentinel(sentinelId, runtime, cycleId, updatedAt) {
  if (sentinelId === "atlas") {
    return {
      ...clone(SENTINEL_ATLAS_SIM),
      cycle_id: cycleId,
      updated_at: updatedAt,
      display_name: runtime.display_name,
      voice: runtime.voice,
      runtime_overlay: {
        display_name: runtime.display_name,
        voice: runtime.voice,
        role: runtime.role,
      },
    };
  }
  const base = SIM_SENTINELS[sentinelId];
  if (!base) {
    return {
      ...runtime,
      id: sentinelId,
      cycle_id: cycleId,
      updated_at: updatedAt,
    };
  }
  const out = {
    ...clone(base),
    cycle_id: cycleId,
    updated_at: updatedAt,
  };
  if (runtime && runtime.id === sentinelId) {
    out.display_name = runtime.display_name;
    out.voice = runtime.voice;
    out.runtime_overlay = {
      display_name: runtime.display_name,
      voice: runtime.voice,
      role: runtime.role,
    };
  }
  return out;
}

function writeSimSentinelRail(cycleId, updatedAt, primaryRuntime) {
  const ids = ["zeus", "jade", "hermes"];
  for (const id of ids) {
    const runtime =
      primaryRuntime.id === id
        ? primaryRuntime
        : {
            id,
            display_name: id.toUpperCase(),
            role: SIM_SENTINELS[id].role,
            voice: "",
          };
    writeJson(path.join("sentinels", `${id}.json`), buildRichSentinel(id, runtime, cycleId, updatedAt));
  }
  if (primaryRuntime.id === "atlas") {
    writeJson(
      path.join("sentinels", "atlas.json"),
      buildRichSentinel("atlas", primaryRuntime, cycleId, updatedAt),
    );
  }
}

function writeCastleZone(cycleId, updatedAt) {
  writeJson(path.join("zones", "castle.json"), {
    ...clone(SIM_ZONE_CASTLE),
    cycle_id: cycleId,
    updated_at: updatedAt,
  });
}

function writeCurrentWorldSummary({
  cycleId,
  updatedAt,
  kvStatus,
  gi,
  vaultProgress,
  rules,
  activeEvent,
  activeQuest,
  sourceMode,
}) {
  const worldMood = pickWorldMood(kvStatus, gi, rules);
  const fountainStatus = pickFountainStatus(rules);
  const body = {
    cycle: cycleId,
    zone: "castle",
    world_mood: worldMood,
    integrity: {
      gi: typeof gi === "number" ? gi : 0,
      kv_status: kvStatus,
      source_mode: sourceMode,
    },
    vault: {
      progress: typeof vaultProgress === "number" ? vaultProgress : 0,
      fountain_status: fountainStatus,
    },
    active_events: [activeEvent.id],
    active_quests: [activeQuest.id],
    active_sentinels: ["zeus", "jade", "hermes"],
  };
  writeJson("current-world.json", body);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(rel, data) {
  const file = path.join(WORLD, rel);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function laneStatusFromTone(tone) {
  if (tone === "warning") return "alarm";
  if (tone === "hope") return "rising";
  if (tone === "calm") return "steady";
  return "watch";
}

function writeLedgerFeed(root, currentCycle, activeEvent, activeQuest, activeSentinel) {
  const feed = {
    node_id: "mobius-hive",
    schema_version: 1,
    updated_at: currentCycle.updated_at,
    cycle_id: currentCycle.cycle_id,
    lanes: {
      world: {
        status: laneStatusFromTone(activeEvent.tone),
        summary: `${activeEvent.title}: ${activeEvent.summary}`,
      },
      quests: {
        status: currentCycle.active_quest_id ? "active" : "dormant",
        summary: activeQuest.title,
      },
      lore: { status: "seed", summary: "Canon lives under docs/lore/." },
      sentinel_state: {
        status: "watch",
        summary: `${activeSentinel.display_name} — ${activeSentinel.role}`,
      },
    },
  };
  fs.mkdirSync(path.join(root, "ledger"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "ledger", "feed.json"),
    `${JSON.stringify(feed, null, 2)}\n`,
    "utf8",
  );
}

function main() {
  const previousCycle = readJson(path.join(WORLD, "current-cycle.json"), null);

  const terminal = readJson(path.join(IN_DIR, "terminal-snapshot.json"), null);
  const cycleState = readJson(path.join(IN_DIR, "cycle-state.json"), null);
  const pulse = readJson(path.join(IN_DIR, "mobius-pulse.json"), null);
  const oaa = readJson(path.join(IN_DIR, "oaa-kv-latest.json"), null);

  const kvStatus = pickKvStatus(terminal, cycleState, oaa);
  const gi = pickGi(pulse, cycleState, terminal);
  const vaultProgress = pickVaultProgress(terminal, cycleState, oaa);
  const cycleId = pickCycleId(cycleState, pulse, terminal);

  const prevVault = previousCycle?.signals?.vault_progress;
  const prevGi = previousCycle?.signals?.gi;

  const vaultDelta =
    typeof vaultProgress === "number" && typeof prevVault === "number"
      ? vaultProgress - prevVault
      : null;

  const giRising =
    typeof gi === "number" && typeof prevGi === "number" ? gi > prevGi : false;

  const vaultRising = typeof vaultDelta === "number" ? vaultDelta > 0 : false;

  const giStrong =
    typeof gi === "number" && (giRising || gi >= 0.95);

  const rules = [];

  let activeEvent = null;
  let activeQuest = null;
  let activeSentinel = null;

  if (kvStatus === "degraded") {
    rules.push("kv_degraded");
    activeEvent = {
      id: "signal-fog",
      title: "Signal Fog",
      tone: "warning",
      summary: "Operator memory lanes are noisy; continuity is at risk.",
    };
    activeQuest = {
      id: "restore-the-beacon",
      title: "Restore the Beacon",
      summary: "Re-stabilize KV paths and confirm OAA fallbacks are healthy.",
    };
    activeSentinel = {
      id: "zeus",
      display_name: "ZEUS",
      role: "stabilization",
      voice: "Hold the line. We do not ship fog as truth.",
    };
  } else if (vaultRising && giStrong) {
    rules.push("vault_rising_and_gi");
    activeEvent = {
      id: "fountain-murmur",
      title: "Fountain Murmur",
      tone: "hope",
      summary: "The vault deepens and integrity rises; the city hears water again.",
    };
    activeQuest = {
      id: "prepare-the-seal",
      title: "Prepare the Seal",
      summary: "Align proofs and ledger anchors before the next cycle boundary.",
    };
    activeSentinel = {
      id: "hermes",
      display_name: "HERMES",
      role: "courier",
      voice: "Carry the proof, not the rumor. Speed without drift.",
    };
  } else {
    rules.push("steady_state");
    activeEvent = {
      id: "quiet-grid",
      title: "Quiet Grid",
      tone: "calm",
      summary: "No mesh alarms fired on this tick.",
    };
    activeQuest = {
      id: "patrol-the-lanes",
      title: "Patrol the Lanes",
      summary: "Keep watch: terminal heartbeat, pulse freshness, OAA seals.",
    };
    activeSentinel = {
      id: "atlas",
      display_name: "ATLAS",
      role: "verification",
      voice: "No drama is also data. Log the null result.",
    };
  }

  const currentCycle = {
    cycle_id: cycleId,
    updated_at: new Date().toISOString(),
    rules_fired: rules,
    active_event_id: activeEvent.id,
    active_quest_id: activeQuest.id,
    active_sentinel_id: activeSentinel.id,
    signals: {
      kv_status: kvStatus,
      gi,
      vault_progress: vaultProgress,
    },
    ingest_health: {
      terminal_snapshot: Boolean(terminal?.ok),
      cycle_state: Boolean(cycleState?.ok),
      mobius_pulse: Boolean(pulse?.ok),
      oaa_kv_latest: Boolean(oaa?.ok),
    },
  };

  ensureDir(WORLD);
  writeJson("current-cycle.json", currentCycle);

  const updatedAt = currentCycle.updated_at;
  const sourceMode = pickSourceMode(kvStatus, terminal, cycleState, oaa);

  writeJson(
    path.join("events", `${activeEvent.id}.json`),
    buildRichEvent(activeEvent, cycleId, updatedAt),
  );
  writeJson(
    path.join("quests", `${activeQuest.id}.json`),
    buildRichQuest(activeQuest, activeSentinel.id, cycleId, updatedAt),
  );

  writeSimSentinelRail(cycleId, updatedAt, activeSentinel);
  writeCastleZone(cycleId, updatedAt);
  writeCurrentWorldSummary({
    cycleId,
    updatedAt,
    kvStatus,
    gi,
    vaultProgress,
    rules,
    activeEvent,
    activeQuest,
    sourceMode,
  });

  const ledgerWorld = {
    cycle_id: cycleId,
    updated_at: currentCycle.updated_at,
    hive: {
      active_event: activeEvent,
      active_quest: activeQuest,
      active_sentinel: activeSentinel,
    },
  };
  fs.mkdirSync(path.join(ROOT, "ledger"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "ledger", "hive-world-state.json"),
    `${JSON.stringify(ledgerWorld, null, 2)}\n`,
    "utf8",
  );

  writeLedgerFeed(ROOT, currentCycle, activeEvent, activeQuest, activeSentinel);

  console.log(
    `mobius-hive: world state refreshed for ${cycleId} (rules: ${rules.join(", ")})`,
  );
}

main();
