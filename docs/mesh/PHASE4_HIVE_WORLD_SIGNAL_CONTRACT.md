# Phase 4 — HIVE World Signal Contract

## Purpose

HIVE is the world simulation and civic signal source of the Mobius Civic Mesh.

It turns world state into civic signal packets that Browser Shell can surface, Terminal can pulse, Substrate can remember, and Civic Ledger can prove.

## Flow

```txt
Terminal snapshot + Substrate pulse + OAA memory
  ↓
HIVE world rules
  ↓
world/current-cycle.json
  ↓
world/hive-world-pulse.json
  ↓
world/civic-signal.json
  ↓
Browser Shell surface
  ↓
Terminal big pulse
  ↓
Substrate memory
  ↓
Civic Ledger proof
```

## HIVE Responsibilities

HIVE reads:

```txt
Terminal snapshot-lite
Terminal cycle-state
Substrate mobius-pulse
OAA latest memory
```

HIVE writes:

```txt
world/current-cycle.json
world/current-world.json
world/events/*.json
world/quests/*.json
world/sentinels/*.json
world/hive-world-pulse.json
world/civic-signal.json
ledger/hive-world-state.json
ledger/feed.json
```

## Event Types

```txt
HIVE_WORLD_PULSE_V1
WORLD_STATE_V1
QUEST_SIGNAL_V1
```

## Safety

HIVE may simulate world pressure and civic meaning.

HIVE does not canonize reality.

Canon requires human merge and proof through the Civic Mesh.

## Idempotency

Each proof-worthy packet includes:

```txt
node_id
event_type
cycle
source_hash
workflow_id
idempotency_key
```

## Canon

HIVE is not just a game.
HIVE is the simulation layer where civic pressure becomes visible.

Browser Shell shows the world.
Terminal pulses the world.
Substrate remembers the world.
Civic Ledger proves what mattered.

We heal as we walk.
