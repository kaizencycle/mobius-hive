import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const IN_DIR = path.join(ROOT, "ledger", "inputs");
const WORLD = path.join(ROOT, "world");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function pickKvStatus(terminalPayload, oaaPayload) {
  const t = terminalPayload?.ok ? terminalPayload.data : null;
  const o = oaaPayload?.ok ? oaaPayload.data : null;
  const direct =
    t?.kv_status ??
    t?.kv?.status ??
    t?.status?.kv ??
    o?.kv_status ??
    o?.status ??
    null;
  if (typeof direct === "string") return direct.toLowerCase();
  if (t?.degraded === true) return "degraded";
  if (t?.lanes?.kv && t.lanes.kv.ok === false) return "degraded";
  return "unknown";
}

function pickGi(pulsePayload, terminalPayload) {
  const p = pulsePayload?.ok ? pulsePayload.data : null;
  const t = terminalPayload?.ok ? terminalPayload.data : null;
  const gi =
    p?.terminal_snapshot?.gi ??
    p?.global_integrity?.score ??
    p?.gi ??
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

function pickVaultProgress(terminalPayload, oaaPayload) {
  const t = terminalPayload?.ok ? terminalPayload.data : null;
  const o = oaaPayload?.ok ? oaaPayload.data : null;
  const v =
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

function pickCycleId(pulsePayload, terminalPayload) {
  const p = pulsePayload?.ok ? pulsePayload.data : null;
  const t = terminalPayload?.ok ? terminalPayload.data : null;
  const id =
    p?.cycle?.id ??
    p?.cycle ??
    p?.current_cycle ??
    p?.cycle_id ??
    p?.mesh?.cycle_id ??
    t?.cycle ??
    t?.lanes?.echo?.cycle ??
    null;
  if (typeof id === "string" && id.trim()) return id.trim();
  return "C-288";
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(rel, data) {
  const file = path.join(WORLD, rel);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function main() {
  const previousCycle = readJson(path.join(WORLD, "current-cycle.json"), null);

  const terminal = readJson(path.join(IN_DIR, "terminal-snapshot.json"), null);
  const pulse = readJson(path.join(IN_DIR, "mobius-pulse.json"), null);
  const oaa = readJson(path.join(IN_DIR, "oaa-kv-latest.json"), null);

  const kvStatus = pickKvStatus(terminal, oaa);
  const gi = pickGi(pulse, terminal);
  const vaultProgress = pickVaultProgress(terminal, oaa);
  const cycleId = pickCycleId(pulse, terminal);

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
      mobius_pulse: Boolean(pulse?.ok),
      oaa_kv_latest: Boolean(oaa?.ok),
    },
  };

  ensureDir(WORLD);
  writeJson("current-cycle.json", currentCycle);

  writeJson(path.join("events", `${activeEvent.id}.json`), {
    ...activeEvent,
    cycle_id: cycleId,
    updated_at: currentCycle.updated_at,
  });
  writeJson(path.join("quests", `${activeQuest.id}.json`), {
    ...activeQuest,
    cycle_id: cycleId,
    updated_at: currentCycle.updated_at,
    sentinel_id: activeSentinel.id,
  });
  writeJson(path.join("sentinels", `${activeSentinel.id}.json`), {
    ...activeSentinel,
    cycle_id: cycleId,
    updated_at: currentCycle.updated_at,
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

  console.log(
    `mobius-hive: world state refreshed for ${cycleId} (rules: ${rules.join(", ")})`,
  );
}

main();
