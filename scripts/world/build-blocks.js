import fs from 'fs';
import path from 'path';

const INPUT = 'ledger/inputs/agent-signals.json';
const OUT_DIR = 'world/blocks';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function buildBlock(signal) {
  return {
    id: `${signal.zone}-${signal.signal_type}-${signal.cycle}-d${signal.day}`,
    type: signal.signal_type,
    zone: signal.zone,
    title: signal.summary,
    state: 'draft',
    cycle: signal.cycle,
    day: signal.day,
    source_agents: [signal.agent],
    integrity: {
      confidence: signal.confidence
    },
    decay: {
      born_day: signal.day,
      ttl_days: 5,
      status: 'fresh'
    }
  };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.log('No agent signals found');
    return;
  }

  const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

  ensureDir(OUT_DIR);

  raw.forEach((signal) => {
    if (signal.confidence < 0.7) return;

    const block = buildBlock(signal);
    const file = path.join(OUT_DIR, `${block.id}.json`);

    fs.writeFileSync(file, JSON.stringify(block, null, 2));
  });

  console.log('Blocks built');
}

main();
