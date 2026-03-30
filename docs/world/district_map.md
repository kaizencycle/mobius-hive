# Mobius HIVE — District Map Spec v0.1

## World frame

**Map type:** central hub world  
**Primary shell:** **The Dome**  
**Design logic:** ring city with a visible civic core

The player should understand the world in under 30 seconds:

- center = governance / identity / civilization core
- middle ring = daily life / markets / learning / agents
- outer ring = labs / quests / expansion / frontier zones

So the map reads like a civilization, not a random game map.

---

## Top-down map structure

```text
                     [ ATLAS WATCH / OUTER WALL ]
                              _________
                         ____/         \____
                    ____/                   \____
                 __/                             \__
               _/                                   \_
              /                                       \
             /   [Lab District]     [Agent Citadel]   \
            /                                             \
           |                                               |
           | [Reflection Gardens]   [Castle of Elders]     |
           |                         [Citizen Plaza]        |
           |                         [Archive Vault]        |
           |                                               |
           | [School of AI / OAA]   [Market Quarter]       |
            \                                             /
             \      [Festival Grounds / Transit Ring]    /
              \_                                       _/
                \__                                 __/
                   \____                       ____/
                        \_____           _____/
                              \_________/
```

This layout makes the center feel sacred and the outer world feel active.

---

## District list

### Core nucleus
- **Citizen Plaza** — spawn, public square, ambient civic center
- **Castle of Elders** — governance fortress and throne scarcity shell
- **Archive Vault** — canon, ledger memory, civilization continuity

### Inner ring
- **Market Quarter** — exchange, trade, resource flow, contract surfaces
- **School of AI / OAA District** — learning, quests, apprenticeship, tutoring
- **Reflection Gardens** — JADE zone, journaling, morale recovery, meaning-making
- **Agent Citadel** — AUREA, ZEUS, EVE, HERMES, ECHO, ATLAS architectural presences

### Outer ring
- **Lab District** — experiments, prototypes, research quests
- **Festival Grounds** — public ritual, oath pools, seasonal events
- **Transit Ring** — portals, district routing, future shard and biome gates

---

## Landmark rule

Every district needs one iconic landmark visible from far away.

Examples:
- Castle = seven-lit crown tower
- Archive = luminous vault spire
- Market = trade beacon / floating coin sigil
- OAA = academy dome
- Reflection = lantern tree / moon pool
- Agent Citadel = tower cluster
- Labs = signal reactor
- Festival Grounds = public flame or stage arch

---

## World-state response

The map should visibly shift with system state:

### Nominal
- warm lighting
- stable banners
- active crowds
- open trade feel

### Elevated
- alert tones
- subtle sky change
- pulse indicators
- agents visibly more active

### Critical
- amber/red warning bands
- limited access in some sectors
- tower alarms
- crowd thinning
- higher ambient tension

### Festival / Renewal
- lights, banners, music, temporary structures, denser social presence

---

## Ledger-to-world hooks

Every major ledger event should create environmental response.

Examples:
- reflection submitted → lantern appears in Reflection Gardens
- governance vote passed → Castle banners shift and public messages update
- Elder unseated → throne light extinguishes, challenge arena activates
- market surge → Quarter brightens and stalls expand
- crisis event → Agent Citadel glows, repair quests appear
- canon artifact created → Archive gains monument or engraved wall entry

---

## MVP recommendation

First playable HIVE shell should prioritize these five districts:

1. **Citizen Plaza**
2. **Castle of Elders**
3. **Archive Vault**
4. **Market Quarter**
5. **Reflection Gardens**

That yields the soul of the system first: public life, authority, memory, economy, and human meaning.

---

## Canon sentence

**The Dome should feel like a civilization arranged around authority, memory, trade, reflection, and growth.**
