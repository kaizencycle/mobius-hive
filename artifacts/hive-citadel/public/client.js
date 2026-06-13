// C-341 write-back client: pseudonymous civic_id + hive.player_event POST.
// Keeps index.html's no-import-except-strings/snapshot convention; this is
// the one additional module Brief F allows.

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

function markPosted(targetId) {
  try {
    const posted = readPosted();
    posted.add(targetId);
    localStorage.setItem(POSTED_KEY, JSON.stringify([...posted]));
  } catch {}
}

export function hasPosted(targetId) {
  return readPosted().has(targetId);
}

async function postOnce(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res;
}

/**
 * Fire-and-forget POST of a hive.player_event with one retry. Never throws —
 * returns { ok: true } or { ok: false, error }. Marks targetId as posted on
 * success so a reload doesn't re-POST a completed node.
 */
export async function postPlayerEvent(attestUrl, { world, zone, action, targetId, cycleId, civicId }) {
  const body = {
    event_type: "hive.player_event",
    payload: {
      world,
      zone,
      action,
      target_id: targetId,
      cycle_id: cycleId,
      civic_id: civicId,
      client_ts: new Date().toISOString(),
    },
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await postOnce(attestUrl, body);
      markPosted(targetId);
      return { ok: true };
    } catch (err) {
      if (attempt === 1) return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
