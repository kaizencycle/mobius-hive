export const SNAPSHOT = {
 "world": {
  "cycle": "C-339",
  "zone": "castle",
  "world_mood": "fogged",
  "integrity": {
   "gi": 0.63,
   "kv_status": "degraded",
   "source_mode": "kv_preferred"
  },
  "vault": {
   "progress": 0.761,
   "fountain_status": "locked"
  },
  "active_events": [
   "signal-fog"
  ],
  "active_quests": [
   "restore-the-beacon"
  ],
  "active_sentinels": [
   "zeus",
   "jade",
   "hermes"
  ]
 },
 "sentinels": {
  "zeus": {
   "name": "ZEUS",
   "role": "integrity",
   "mood": "alert",
   "voice": "Hold the line. We do not ship fog as truth."
  },
  "jade": {
   "name": "JADE",
   "role": "narrative",
   "mood": "reflective",
   "voice": "The chamber remembers."
  },
  "hermes": {
   "name": "HERMES",
   "role": "economy",
   "mood": "watching",
   "voice": "Movement gathers near the Fountain."
  },
  "atlas": {
   "name": "ATLAS",
   "role": "verification",
   "mood": "calm",
   "voice": "No drama is also data. Log the null result."
  }
 },
 "quest": {
  "id": "restore-the-beacon",
  "title": "Restore the Beacon",
  "summary": ""
 }
};
export const LIVE_URL = "https://raw.githubusercontent.com/kaizencycle/mobius-hive/main/world/current-world.json";

export const REALM_AGENTS = {
  echo:   { name: "ECHO",   role: "Agent of Self & Growth", mood: "watchful",
            voice: "Awareness first. Healing follows. Evolution is the proof." },
  athena: { name: "ATHENA", role: "Agent of Logic & Wisdom", mood: "clear",
            voice: "Reason is a lantern. I keep mine lit for anyone who asks." },
  dao:    { name: "DAO",    role: "Agent of Balance & Flow", mood: "calm",
            voice: "The river does not force the valley. It simply continues." },
  sofia:  { name: "SOFIA",  role: "Agent of Meaning & Faith", mood: "steady",
            voice: "Purpose is not given. It is noticed, then chosen." },
};
