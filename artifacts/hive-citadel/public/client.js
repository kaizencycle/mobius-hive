// C-341 write-back client: pseudonymous civic_id + hive.player_event POST.
// Keeps index.html's no-import-except-strings/snapshot convention; this is
// the one additional module Brief F allows.

import {
  buildHivePlayerEventBody,
  sanitizeAttestError,
} from "./operation-id.js";

const CIVIC_ID_KEY = "hive.civic_id";
const POSTED_KEY = "hive.posted_targets";

export function getCivicId() {
  try {
    let id = localStorage.getItem(CIVIC_ID_KEY);
    if (!id) {
      id = "mobius-anon-" + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(CIVIC_ID_KEY, id);
    }
    return id;
  } catch {
    return "mobius-anon-ephemeral";
  }
}

function readPosted() {
  try {
    return new Set(JSON.parse(localStorage.getItem(POSTED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function markPosted(key) {
  try {
    const posted = readPosted();
    posted.add(key);
    localStorage.setItem(POSTED_KEY, JSON.stringify([...posted]));
  } catch {}
}

// Cache key includes cycle_id so a target ID reused in a later cycle isn't
// skipped as "already posted".
function cacheKey(cycleId, targetId) {
  return cycleId + ":" + targetId;
}

export function hasPosted(cycleId, targetId) {
  return readPosted().has(cacheKey(cycleId, targetId));
}

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

async function postOnce(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error("HTTP " + res.status);
    err.status = res.status;
    throw err;
  }
  return res;
}

/**
 * Fire-and-forget POST of a hive.player_event with bounded retry on ambiguous
 * failures. Never throws — returns { ok: true } or { ok: false, error }.
 * operation_id is stable across retries; markPosted runs only after success.
 */
export async function postPlayerEvent(attestUrl, { world, zone, action, targetId, cycleId, civicId }) {
  const body = await buildHivePlayerEventBody({
    world,
    zone,
    action,
    targetId,
    cycleId,
    civicId,
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await postOnce(attestUrl, body);
      markPosted(cacheKey(cycleId, targetId));
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
