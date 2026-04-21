import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const PROPOSAL = path.join(ROOT, "ledger", "quest-proposals", "latest.json");
const OUT_DIR = path.join(ROOT, "ledger", "quest-proposals");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function main() {
  if (!fs.existsSync(PROPOSAL)) {
    console.error(
      "mobius-hive: missing ledger/quest-proposals/latest.json — run generate-quest-proposal first",
    );
    process.exitCode = 1;
    return;
  }

  const proposal = readJson(PROPOSAL);
  const cycleFile = String(proposal.cycle_id ?? "unknown").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const markerPath = path.join(OUT_DIR, `pr-${cycleFile}.marker.json`);
  const marker = {
    schema_version: 1,
    created_at: proposal.generated_at,
    cycle_id: proposal.cycle_id,
    note: "Automated quest proposal marker committed to default branch (no ephemeral PR branch).",
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
  console.log(`mobius-hive: wrote ${path.relative(ROOT, markerPath)}`);
}

main();
