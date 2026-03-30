# Mobius HIVE — MVP Screen Flow v0.1

## Purpose

This document translates the HIVE world shell into a usable product flow.

It answers a practical question:

**What does the player actually see and do, screen by screen, in the first playable version of HIVE?**

The goal is to keep the experience:
- world-first
- emotionally legible
- mechanically clear
- usable like software
- alive like a civilization shell

---

## Core design rule

**World for orientation. Overlay for precision.**

That means:
- the player should feel like they are in a place
- when they need to do a precise action, the UI overlay should open cleanly
- the overlay should never make the world irrelevant

---

## MVP flow overview

```text
Login / Entry
→ Spawn in Citizen Plaza
→ Read current world state
→ Move to district or select destination
→ Inspect building, NPC, or agent
→ Open overlay for exact action
→ Complete loop
→ World responds visibly
→ Reflection / archive / logout
```

This is the core HIVE experience in one sentence.

---

# Screen-by-screen flow

## 1. Entry Screen
**Purpose:** establish tone, continuity, and identity

### What the player sees
- Mobius HIVE title
- subtle animated Dome backdrop
- current cycle
- login / continue / guest observer options
- one-line world status
- optional latest event banner

### Key actions
- continue as returning player
- enter as guest observer
- view current cycle summary
- open canon / intro

### Tone goal
This screen should say:
**you are not logging into an app, you are entering a world already in motion**

---

## 2. Spawn Screen — Citizen Plaza
**Purpose:** orient the player immediately

### What the player sees
- avatar in Citizen Plaza
- Castle silhouette
- visible district landmarks
- ambient public activity
- top-line HUD with:
  - cycle
  - location
  - alerts/events
  - profile shortcut
  - quick action menu

### MVP HUD
- top left: cycle + district
- top center: world state banner
- top right: profile / resources / notifications
- bottom center: contextual action bar
- bottom right: minimap / district quick travel

### Key actions
- walk
- rotate / inspect
- open minimap
- open quick actions
- click landmark / district destination

### Tone goal
The player should know in under 10 seconds:
- where they are
- what matters right now
- where they can go next

---

## 3. District Navigation Flow
**Purpose:** make the world traversable without confusion

### Navigation methods
#### A. Physical movement
- walk through Plaza and roads
- approach landmarks
- discover environmental cues

#### B. Map-assisted movement
- click minimap district
- show route line
- optional teleport / portal if unlocked

#### C. Quick destinations
- Castle
- Archive
- Market
- Reflections
- School

### UX rule
First-time players should mostly walk.  
Returning players should be allowed to route fast.

---

## 4. Building Inspect Flow
**Purpose:** make architecture interactive

When player approaches a building, structure, or institution:

### What happens
- building name appears
- role/type appears
- light contextual metadata appears
- interact prompt appears

### Example inspect card
- name: Reflection Garden Annex
- type: personal / civic / institutional
- owner or steward
- current activity status
- available actions

### Key actions
- inspect
- enter
- bookmark
- route here later

### Tone goal
Buildings should feel like social objects, not static scenery.

---

## 5. Overlay Open Flow
**Purpose:** switch from world mode to action mode cleanly

When player selects an action, a contextual overlay opens.

### Overlay types
- **Reflection overlay**
- **Market overlay**
- **Governance overlay**
- **Learning overlay**
- **Profile / building overlay**
- **Archive overlay**

### UI rule
The overlay should:
- preserve awareness of the world behind it
- feel spatially connected to the place it came from
- be dismissible without disorientation

### Bad version
Full app takeover that makes the world disappear.

### Good version
Panel, modal, or split view that still feels anchored to the location.

---

## 6. Reflection Flow
**District:** Reflection Gardens

### Player path
Spawn → route to Gardens → inspect reflection node → open journal overlay

### Reflection overlay includes
- write reflection
- cycle prompt
- mood / meaning tags
- archive privately or publicly
- save and close

### World response
- lantern lights
- memory flora blooms
- archive note optionally generated

### Success feeling
**I did not just write text. I left a trace in the world.**

---

## 7. Market Flow
**District:** Market Quarter

### Player path
Spawn → route to Market → inspect stall/board → open exchange overlay

### Market overlay includes
- wallet/resources
- listings
- buy/sell/trade
- stake / lock / burn actions when appropriate
- market signals or district activity

### World response
- stall activity changes
- nearby district feels busier
- economic flow becomes visible

### Success feeling
**value is moving through a place, not just through a spreadsheet**

---

## 8. Governance Flow
**District:** Castle of Elders or Festival Grounds

### Player path
Spawn → route to governance site → inspect assembly space → open governance overlay

### Governance overlay includes
- active proposals
- quorum / legitimacy indicators
- support / oppose / abstain flows
- oath staking if relevant
- countdowns / consequences

### World response
- banners shift
- throne or decree visuals update
- public square notices change

### Success feeling
**my political action visibly alters the civilization shell**

---

## 9. Learning Flow
**District:** School of AI / OAA

### Player path
Spawn → route to School → inspect lesson hall → open lesson overlay

### Learning overlay includes
- lesson catalog
- recommended modules
- active quest or challenge
- mentor/agent guidance
- rewards/progression markers

### World response
- school wing lights up
- lesson completion markers appear
- personal building may gain educational detail over time

### Success feeling
**learning changes both me and the world**

---

## 10. Archive Flow
**District:** Archive Vault

### Player path
Spawn → route to Archive → inspect vault node → open archive explorer

### Archive overlay includes
- cycle history
- canon records
- public events
- personal memory timeline
- search / inspect mode

### World response
Mostly informational, but major events may unlock plaques, new shelves, or visible monuments.

### Success feeling
**this world remembers**

---

## 11. Profile / Building Flow
**Context:** from player structure or profile shortcut

### Player path
Inspect own building → open building/profile overlay

### Overlay includes
- current tier
- contribution summary
- role identity
- progression triggers
- customization or room access
- recent visible marks on the world

### World response
This is where the player understands how identity becomes architecture.

### Success feeling
**my structure tells the truth about how I live in this civilization**

---

## 12. Logout / Cycle Close Flow
**Purpose:** leave with continuity, not abrupt exit

### What the player sees
- current cycle summary
- today’s contributions
- unresolved items
- reflection prompt
- return anchor for next login

### Optional actions
- save note
- pin tomorrow intent
- archive event
- exit world

### Success feeling
**I am leaving a world that will still exist when I return**

---

# HUD and UI layers

## Always-visible layer
- cycle
- location
- world state
- profile/resources shortcut
- notifications

## Context layer
- inspect prompt
- nearby interaction hints
- route line / district label

## Overlay layer
- precise action UI tied to current place

## Rule
Never show every system at once.  
The world must breathe.

---

# MVP district-to-overlay mapping

| District | Primary Overlay | Core Loop |
|---|---|---|
| Citizen Plaza | world summary / current events | orientation |
| Castle of Elders | governance overlay | vote / legitimacy |
| Archive Vault | archive explorer | memory / canon |
| Market Quarter | exchange overlay | trade / utility |
| Reflection Gardens | journal overlay | reflection / meaning |
| School of AI / OAA | lesson overlay | learn / earn |

---

# MVP session examples

## Session A — 3 minute casual return
- login
- spawn in Plaza
- read world banner
- walk to Reflection Gardens
- write 1 short reflection
- lantern lights
- logout

## Session B — 10 minute engaged session
- login
- open minimap
- fast travel to School
- complete one lesson
- route to Market
- spend / stake reward
- inspect own building
- logout

## Session C — governance session
- login
- route to Castle
- inspect active proposal
- vote / stake oath
- see banner change
- check Archive record
- logout

---

# UX anti-failure rules

Do not let HIVE become:
- a flat dashboard wearing fantasy clothes
- a beautiful world with no useful actions
- a software tool with a fake lobby
- a menu maze
- a lore shell disconnected from function

### Guardrails
- every major place must map to a real action
- every major action should have visible world feedback
- every session should end with a sense of continuity

---

## Canon sentence

**The MVP screen flow should make the player feel that they are moving through a living civilization, then opening precise interfaces only when necessary to act within it.**
