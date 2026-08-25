/**
 * Browser mirror of lib/hive-player-event.mjs (Web Crypto random operation IDs).
 */

const OPERATION_ID_RE = /^hive-op-[a-f0-9]{32}$/;

export function generateHiveOperationId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `hive-op-${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function operationStorageKey(cycleId, targetId) {
  return `hive.operation_id.${cycleId}:${targetId}`;
}

export function getOrCreateOperationId(cycleId, targetId) {
  const key = operationStorageKey(cycleId, targetId);
  try {
    const existing = localStorage.getItem(key);
    if (existing && OPERATION_ID_RE.test(existing)) return existing;
    const created = generateHiveOperationId();
    localStorage.setItem(key, created);
    return created;
  } catch {
    return generateHiveOperationId();
  }
}

export async function buildHivePlayerEventBody(fields) {
  const operationId =
    fields.operationId ?? getOrCreateOperationId(fields.cycleId, fields.targetId);
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

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export async function postHivePlayerEvent(attestUrl, fields) {
  const body = await buildHivePlayerEventBody(fields);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(attestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = new Error("HTTP " + res.status);
        err.status = res.status;
        throw err;
      }
      return { ok: true, operationId: body.operation_id };
    } catch (err) {
      const retryable =
        err instanceof TypeError ||
        (err && typeof err.status === "number" && RETRYABLE_STATUSES.has(err.status));
      if (attempt === 1 || !retryable) {
        return { ok: false, error: sanitizeAttestError(err), operationId: body.operation_id };
      }
    }
  }
}
