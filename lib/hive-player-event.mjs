/**
 * C-414: stable operation_id for hive.player_event ledger writes.
 * Canonical implementation — browser clients mirror operation-id helpers.
 */

import { randomBytes } from "node:crypto";

const OPERATION_ID_RE = /^hive-op-[a-f0-9]{32}$/;

export function generateHiveOperationId() {
  return `hive-op-${randomBytes(16).toString("hex")}`;
}

export function operationStorageKey(cycleId, targetId) {
  return `hive.operation_id.${cycleId}:${targetId}`;
}

/**
 * In-memory storage for tests; browsers pass localStorage.
 */
export function getOrCreateOperationId(cycleId, targetId, storage = null) {
  const key = operationStorageKey(cycleId, targetId);
  if (storage) {
    const existing = storage.get(key);
    if (existing && isValidHiveOperationId(existing)) return existing;
    const created = generateHiveOperationId();
    storage.set(key, created);
    return created;
  }
  return generateHiveOperationId();
}

export function buildHivePlayerEventBody({
  world,
  zone,
  action,
  targetId,
  cycleId,
  civicId,
  operationId,
  clientTs = new Date().toISOString(),
}) {
  if (!operationId || !isValidHiveOperationId(operationId)) {
    throw new Error("operationId must match hive-op-<32 hex chars>");
  }
  return {
    event_type: "hive.player_event",
    civic_id: civicId,
    lab_source: "hive",
    operation_id: operationId,
    payload: {
      world,
      zone,
      action,
      target_id: targetId,
      cycle_id: cycleId,
      civic_id: civicId,
      client_ts: clientTs,
    },
  };
}

export function isValidHiveOperationId(operationId) {
  return typeof operationId === "string" && OPERATION_ID_RE.test(operationId);
}

export function sanitizeAttestError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/mobius-anon-[A-Za-z0-9]{4,32}/g, "[civic_id]");
}
