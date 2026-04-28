import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const INPUT = path.join(ROOT, 'ledger', 'inputs', 'agent-signals.json');
const OUT_DIR = path.join(ROOT, 'world', 'blocks');

const ALLOWED_BLOCK_TYPES = new Set([
  'verification',
  'boundary',
  'route',
  'memory',
  'morale',
  'synthesis',
  'stability',
]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isValidSignal(signal) {
  return (
    signal &&
    typeof signal.agent === 'string' &&
    typeof signal.cycle === 'string' &&
    Number.isInteger(signal.day) &&
    signal.day >= 1 &&
    typeof signal.signal_type === 'string' &&
    ALLOWED_BLOCK_TYPES.has(signal.signal_type) &&
    typeof signal.zone === 'string' &&
    typeof signal.confidence === 'number' &&
    signal.confidence >= 0 &&
    signal.confidence <= 1 &&
    typeof signal.summary === 'string'
  );
}

function buildBlock(signal) {
  const zone = slug(signal.zone);
  const signalType = slug(signal.signal_type);
  const cycle = slug(signal.cycle);
  const id = `${zone}-${signalType}-${cycle}-d${signal.day}`;

  return {
    id,
    type: signal.signal_type,
    zone,
    title: signal.summary,
    state: 'draft',
    cycle: signal.cycle,
    day: signal.day,
    source_agents: [signal.agent],
    integrity: {
      confidence: signal.confidence,
    },
    decay: {
      born_day: signal.day,
      ttl_days: 5,
      status: 'fresh',
    },
  };
}

function outputPathForBlock(block) {
  const filename = `${block.id}.json`;
  const resolved = path.resolve(OUT_DIR, filename);
  const outRoot = `${path.resolve(OUT_DIR)}${path.sep}`;

  if (!resolved.startsWith(outRoot)) {
    throw new Error(`Unsafe block output path: ${filename}`);
  }

  return resolved;
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.log('No agent signals found');
    return;
  }

  const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
  if (!Array.isArray(raw)) {
    throw new Error('agent-signals.json must contain an array of signals');
  }

  ensureDir(OUT_DIR);

  let built = 0;
  for (const signal of raw) {
    if (!isValidSignal(signal) || signal.confidence < 0.7) continue;

    const block = buildBlock(signal);
    const file = outputPathForBlock(block);

    fs.writeFileSync(file, `${JSON.stringify(block, null, 2)}\n`);
    built += 1;
  }

  console.log(`Blocks built: ${built}`);
}

main();
