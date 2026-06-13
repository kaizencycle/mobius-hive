import fs from "node:fs";
import path from "node:path";
import { readIngestReadUrls } from "./ingest-config.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "ledger", "inputs");
const CURSOR_FILE = path.join(ROOT, "world", ".player-events-cursor.json");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const text = await res.text();
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: false, error: "response was not valid JSON", sample: text.slice(0, 500) };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const urls = readIngestReadUrls();
  const baseUrl = urls.player_events;
  const cursor = readJson(CURSOR_FILE, { since: null });

  if (!baseUrl) {
    writeJson(path.join(OUT_DIR, "player-events.json"), {
      ok: false,
      fetched_at: new Date().toISOString(),
      error: "missing player_events read_url in mobius.yaml ingest.sources",
      events: [],
    });
    console.log("mobius-hive: player_events source not configured; wrote empty payload");
    return;
  }

  const url = cursor.since
    ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}since=${encodeURIComponent(cursor.since)}`
    : baseUrl;

  const result = await fetchJson(url);
  const events = Array.isArray(result.data?.events) ? result.data.events : [];

  writeJson(path.join(OUT_DIR, "player-events.json"), {
    ok: result.ok,
    fetched_at: new Date().toISOString(),
    error: result.error,
    events,
  });

  if (result.ok && events.length > 0) {
    const last = events[events.length - 1];
    const nextCursor = last?.id ?? last?.event_id ?? cursor.since;
    if (nextCursor) writeJson(CURSOR_FILE, { since: nextCursor });
  }

  if (!result.ok) {
    console.log(`mobius-hive: player_events fetch failed (${result.error}); treating as no new events`);
    return;
  }
  console.log(`mobius-hive: fetched ${events.length} player event(s)`);
}

await main();
