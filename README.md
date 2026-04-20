# Mobius HIVE

Mobius HIVE is the civilization shell of Mobius: a ledger-native social world where identity becomes architecture, contribution becomes terrain, governance becomes ritual space, and memory becomes world state.

## Canon

> If Git City turns contribution into a city, Mobius HIVE turns contribution, governance, memory, and meaning into a civilization.

## Initial structure

- `docs/world/` — spatial world design, district maps, zones
- `docs/game/` — player loops, systems, progression
- `docs/economy/` — token, utility, governance, sinks/sources
- `docs/lore/` — canon, founding myths, houses, rituals

## First artifacts

- district map spec
- player loop diagram
- building progression model
- MVP screen flow

## Mobius Mesh (v1)

This repo participates in the Mobius mesh as a **world node**:

- `mobius.yaml` — declares node identity, ingest sources, scheduled jobs, and governance gates
- `.github/workflows/world-update.yml` — pulls remote mesh inputs and refreshes `world/` + `ledger/hive-world-state.json`
- `.github/workflows/quest-proposal.yml` — generates a proposal artifact and (in GitHub Actions) opens a **draft** PR for sentinel/human review

Human-facing rendering belongs in `mobius-browser-shell`, which should treat `world/current-cycle.json` and friends as read-only inputs.
