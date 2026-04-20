import fs from "node:fs";
import path from "node:path";
import { readIngestReadUrls } from "./ingest-config.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "ledger", "inputs");

async function fetchJson(url, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return {
        ok: false,
        source: label,
        url,
        status: res.status,
        error: `HTTP ${res.status}`,
      };
    }
    const text = await res.text();
    try {
      return { ok: true, source: label, url, data: JSON.parse(text) };
    } catch {
      return {
        ok: false,
        source: label,
        url,
        error: "response was not valid JSON",
        sample: text.slice(0, 500),
      };
    }
  } catch (err) {
    return {
      ok: false,
      source: label,
      url,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const urls = readIngestReadUrls();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const terminal = urls.terminal_snapshot
    ? await fetchJson(urls.terminal_snapshot, "terminal_snapshot")
    : { ok: false, error: "missing terminal_snapshot read_url" };
  const pulse = urls.cycle_state
    ? await fetchJson(urls.cycle_state, "cycle_state")
    : { ok: false, error: "missing cycle_state read_url" };
  const oaa = urls.sovereign_memory
    ? await fetchJson(urls.sovereign_memory, "sovereign_memory")
    : { ok: false, error: "missing sovereign_memory read_url" };

  writeJson(path.join(OUT_DIR, "terminal-snapshot.json"), terminal);
  writeJson(path.join(OUT_DIR, "mobius-pulse.json"), pulse);
  writeJson(path.join(OUT_DIR, "oaa-kv-latest.json"), oaa);

  const manifest = {
    fetched_at: new Date().toISOString(),
    sources: {
      terminal_snapshot: { ok: terminal.ok, url: terminal.url },
      cycle_state: { ok: pulse.ok, url: pulse.url },
      sovereign_memory: { ok: oaa.ok, url: oaa.url },
    },
  };
  writeJson(path.join(OUT_DIR, "manifest.json"), manifest);

  // Non-zero only when every source failed (keeps scheduled runs noisy on partial outages).
  const anyOk = terminal.ok || pulse.ok || oaa.ok;
  if (!anyOk) {
    console.error("mobius-hive: all ingest fetches failed; wrote error payloads to ledger/inputs/");
    process.exitCode = 1;
  }
}

await main();
