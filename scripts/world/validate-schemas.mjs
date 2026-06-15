import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

function readJson(rel) {
  const p = path.join(ROOT, rel);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadSchema(name) {
  const p = path.join(ROOT, "schemas", name);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const ajv = new Ajv({ allErrors: true, strict: false });

const checks = [
  ["world.schema.json", "world/current-world.json"],
  ["event.schema.json", "world/events/signal-fog.json"],
  ["quest.schema.json", "world/quests/restore-the-beacon.json"],
  ["sentinel.schema.json", "world/sentinels/zeus.json"],
  ["sentinel.schema.json", "world/sentinels/jade.json"],
  ["sentinel.schema.json", "world/sentinels/hermes.json"],
  ["zone.schema.json", "world/zones/castle.json"],
  ["zone.schema.json", "world/zones/realm-of-self.json"],
  ["zone.schema.json", "world/zones/realm-of-reason.json"],
  ["zone.schema.json", "world/zones/ocean-of-inquiry.json"],
  ["zone.schema.json", "world/zones/realm-of-harmony.json"],
  ["zone.schema.json", "world/zones/realm-of-meaning.json"],
  ["zone.schema.json", "world/zones/realm-of-unity.json"],
  ["zone.schema.json", "world/zones/frontier-of-tomorrow.json"],
  ["zone.schema.json", "world/zones/path-of-evolution.json"],
  ["zone.schema.json", "world/zones/spark-of-potential.json"],
  ["citizen-history.schema.json", "world/citizen-history.json"],
  ["realms.schema.json", "world/realms.json"],
];

let failed = false;
for (const [schemaFile, dataFile] of checks) {
  const validate = ajv.compile(loadSchema(schemaFile));
  const data = readJson(dataFile);
  if (!validate(data)) {
    failed = true;
    console.error(`mobius-hive: schema validation failed for ${dataFile}`);
    console.error(validate.errors);
  }
}

if (failed) {
  process.exit(1);
}
console.log("mobius-hive: all schema checks passed");
