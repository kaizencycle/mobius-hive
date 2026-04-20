import fs from "node:fs";
import path from "node:path";
import { ingestUrlsForFetch, readIngestReadUrls } from "./ingest-config.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "ledger", "inputs");
const FIXTURES_DIR = path.join(ROOT, "scripts", "world", "fixtures");

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

function copyFixture(name) {
  const from = path.join(FIXTURES_DIR, name);
  const to = path.join(OUT_DIR, name);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.copyFileSync(from, to);
}

async function main() {
  const urls = ingestUrlsForFetch(readIngestReadUrls());
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (process.env.HIVE_USE_FIXTURES === "1") {
    copyFixture("terminal-snapshot.json");
    copyFixture("cycle-state.json");
    copyFixture("mobius-pulse.json");
    copyFixture("oaa-kv-latest.json");
    const manifest = {
      fetched_at: new Date().toISOString(),
      mode: "fixtures",
      sources: {
        terminal_snapshot: { ok: true, url: "fixture://terminal-snapshot" },
        cycle_state: { ok: true, url: "fixture://cycle-state" },
        mesh_pulse: { ok: true, url: "fixture://mobius-pulse" },
        sovereign_memory: { ok: true, url: "fixture://oaa-kv-latest" },
      },
    };
    writeJson(path.join(OUT_DIR, "manifest.json"), manifest);
    console.log("mobius-hive: wrote fixture inputs to ledger/inputs/");
    return;
  }

  const terminal = urls.terminal_snapshot
    ? await fetchJson(urls.terminal_snapshot, "terminal_snapshot")
    : { ok: false, error: "missing terminal_snapshot read_url" };
  const cycleState = urls.cycle_state
    ? await fetchJson(urls.cycle_state, "cycle_state")
    : { ok: false, error: "missing cycle_state read_url" };
  const meshPulse = urls.mesh_pulse
    ? await fetchJson(urls.mesh_pulse, "mesh_pulse")
    : { ok: false, error: "missing mesh_pulse read_url" };
  const oaa = urls.sovereign_memory
    ? await fetchJson(urls.sovereign_memory, "sovereign_memory")
    : { ok: false, error: "missing sovereign_memory read_url" };

  writeJson(path.join(OUT_DIR, "terminal-snapshot.json"), terminal);
  writeJson(path.join(OUT_DIR, "cycle-state.json"), cycleState);
  writeJson(path.join(OUT_DIR, "mobius-pulse.json"), meshPulse);
  writeJson(path.join(OUT_DIR, "oaa-kv-latest.json"), oaa);

  const manifest = {
    fetched_at: new Date().toISOString(),
    sources: {
      terminal_snapshot: { ok: terminal.ok, url: terminal.url },
      cycle_state: { ok: cycleState.ok, url: cycleState.url },
      mesh_pulse: { ok: meshPulse.ok, url: meshPulse.url },
      sovereign_memory: { ok: oaa.ok, url: oaa.url },
    },
  };
  writeJson(path.join(OUT_DIR, "manifest.json"), manifest);

  // Non-zero only when every source failed (keeps scheduled runs noisy on partial outages).
  const anyOk = terminal.ok || cycleState.ok || meshPulse.ok || oaa.ok;
  if (!anyOk) {
    console.error("mobius-hive: all ingest fetches failed; wrote error payloads to ledger/inputs/");
    process.exitCode = 1;
  }
}

await main();
