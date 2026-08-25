/**
 * C-414: stable operation_id for hive.player_event ledger writes.
 * Canonical implementation — browser clients mirror this algorithm.
 */

import { createHash } from "node:crypto";

const OPERATION_ID_RE = /^hive-op-[a-f0-9]{32}$/;

export function buildHivePlayerEventOperationId({
  civicId,
  world,
  zone,
  action,
  targetId,
  cycleId,
}) {
  const material = [civicId, world, zone, action, targetId, cycleId].join("\0");
  return `hive-op-${createHash("sha256").update(material).digest("hex").slice(0, 32)}`;
}

export function buildHivePlayerEventBody({
  world,
  zone,
  action,
  targetId,
  cycleId,
  civicId,
  clientTs = new Date().toISOString(),
}) {
  const operationId = buildHivePlayerEventOperationId({
    civicId,
    world,
    zone,
    action,
    targetId,
    cycleId,
  });
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

/**
 * Browser-safe SHA-256 hex (async). Mirrors buildHivePlayerEventOperationId.
 */
export async function buildHivePlayerEventOperationIdAsync(fields) {
  const material = [
    fields.civicId,
    fields.world,
    fields.zone,
    fields.action,
    fields.targetId,
    fields.cycleId,
  ].join("\0");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `hive-op-${hex.slice(0, 32)}`;
}

export async function buildHivePlayerEventBodyAsync(fields) {
  const operationId = await buildHivePlayerEventOperationIdAsync(fields);
  const clientTs = fields.clientTs ?? new Date().toISOString();
  return {
    event_type: "hive.player_event",
    civic_id: fields.civicId,
    lab_source: "hive",
    operation_id: operationId,
    payload: {
      world: fields.world,
      zone: fields.zone,
      action: fields.action,
      target_id: fields.targetId,
      cycle_id: fields.cycleId,
      civic_id: fields.civicId,
      client_ts: clientTs,
    },
  };
}
