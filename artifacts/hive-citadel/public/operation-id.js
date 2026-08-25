/**
 * Browser mirror of lib/hive-player-event.mjs (async Web Crypto).
 */

export async function buildHivePlayerEventOperationId({
  civicId,
  world,
  zone,
  action,
  targetId,
  cycleId,
}) {
  const material = [civicId, world, zone, action, targetId, cycleId].join("\0");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `hive-op-${hex.slice(0, 32)}`;
}

export async function buildHivePlayerEventBody(fields) {
  const operationId = await buildHivePlayerEventOperationId(fields);
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

export function sanitizeAttestError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/mobius-anon-[A-Za-z0-9]{4,32}/g, "[civic_id]");
}
