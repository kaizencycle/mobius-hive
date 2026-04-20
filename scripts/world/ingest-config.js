import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const MOBIUS_YAML = path.join(ROOT, "mobius.yaml");

/**
 * Parses mobius.yaml for ingest.sources.*.read_url without a YAML dependency.
 * Expects 4-space-indented keys under `ingest:` / `sources:` as written by this repo.
 */
export function readIngestReadUrls() {
  const text = fs.readFileSync(MOBIUS_YAML, "utf8");
  const lines = text.split(/\r?\n/);
  let inIngest = false;
  let inSources = false;
  let currentSource = null;
  const urls = {};

  for (const line of lines) {
    if (/^ingest:\s*$/.test(line)) {
      inIngest = true;
      inSources = false;
      currentSource = null;
      continue;
    }
    if (inIngest && /^  sources:\s*$/.test(line)) {
      inSources = true;
      currentSource = null;
      continue;
    }
    if (inIngest && inSources) {
      const sourceKey = line.match(/^    ([a-zA-Z0-9_]+):\s*$/);
      if (sourceKey) {
        currentSource = sourceKey[1];
        continue;
      }
      const readUrl = line.match(/^\s+read_url:\s*"(.*)"\s*$/);
      if (readUrl && currentSource) {
        urls[currentSource] = readUrl[1];
        continue;
      }
    }
    if (inIngest && /^[a-zA-Z_]+:\s*$/.test(line) && !line.startsWith("  ")) {
      inIngest = false;
      inSources = false;
      currentSource = null;
    }
  }

  return urls;
}

/**
 * @param {Record<string, string>} urls
 */
export function ingestUrlsForFetch(urls) {
  const meshPulse = urls.mesh_pulse ?? urls.cycle_state;
  return {
    terminal_snapshot: urls.terminal_snapshot,
    cycle_state: urls.cycle_state,
    mesh_pulse: meshPulse,
    sovereign_memory: urls.sovereign_memory,
  };
}
