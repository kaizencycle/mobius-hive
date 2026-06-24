/**
 * Mobius HIVE — baked world snapshot (cycle C-352, auto-baked by bake-snapshot.mjs).
 *
 * This is a frozen projection of the live `world/*.json` contracts in the
 * mobius-hive repo, embedded so the deployed game is fully self-contained.
 * When served from the repo root (or with `?data=<base>`), `game.js` will
 * try to fetch the live `world/current-world.json` and overlay it on top of
 * this snapshot — so the simulator stays accurate as the cycle advances.
 *
 * Re-baked: 2026-06-24T22:21:38.402Z
 */

export const WORLD_SNAPSHOT = {
  cycle: "C-352",
  updated_at: "2026-06-24T22:21:38.402Z",
  world_mood: "fogged",
  integrity: { gi: 0.64, kv_status: "degraded", source_mode: "kv_preferred" },
  vault: { progress: 0.779, fountain_status: "locked" },
  active_events: ["signal-fog"],
  active_quests: ["restore-the-beacon"],
  active_sentinels: ["zeus","jade","hermes"],
  citizen_history: [],


























































  event: {
    id: "signal-fog",
    title: "Signal Fog",
    severity: "medium",
    description: "The lattice is visible, but unstable. Memory remains, live sight fades.",
    summary: "Operator memory lanes are noisy; continuity is at risk.",
    overlay: "fog",
  },

  quest: {
    id: "restore-the-beacon",
    title: "Restore the Beacon",
    description: "Re-establish live signal continuity across the HIVE.",
    assigned_by: "zeus",
  },

  // Realm graph (mirrors world/realms.json). Each realm is a region in the
  // overworld with a primary agent, a dormant beacon, and integrity shards
  // hidden in the Signal Fog.
  realms: [
    {
      id: "forge-of-civilization",
      title: "Forge of Civilization",
      hub: true,
      color: "#e8c547",
      agent: "aurelius",
      blurb: "The central chamber of oversight. Every realm connects back here.",
    },
    {
      id: "realm-of-self",
      title: "Realm of Self",
      color: "#ffb84a",
      agent: "echo",
      blurb: "A hall of mirrors where citizens reflect before stepping outward.",
    },
    {
      id: "realm-of-reason",
      title: "Realm of Reason",
      color: "#4a9fff",
      agent: "athena",
      blurb: "A study of logic where plans are tested before they are acted upon.",
    },
    {
      id: "ocean-of-inquiry",
      title: "Ocean of Inquiry",
      color: "#3dd6ff",
      agent: "oracle",
      blurb: "Open water dotted with archive-islands; questions cast, answers returned.",
    },
    {
      id: "realm-of-harmony",
      title: "Realm of Harmony",
      color: "#6fe06f",
      agent: "dao",
      blurb: "A balanced courtyard keeping the HIVE's incentives in tune.",
    },
    {
      id: "realm-of-meaning",
      title: "Realm of Meaning",
      color: "#ff6f8f",
      agent: "sofia",
      blurb: "A library of living stories tending the threads of meaning.",
    },
    {
      id: "realm-of-unity",
      title: "Realm of Unity",
      color: "#ff8fc4",
      agent: "heartis",
      blurb: "A gathering green watching over bonds between citizens and sentinels.",
    },
    {
      id: "frontier-of-tomorrow",
      title: "Frontier of Tomorrow",
      color: "#3dffea",
      agent: "vision",
      blurb: "A proving ground sketching what the HIVE could become next.",
    },
    {
      id: "path-of-evolution",
      title: "Path of Evolution",
      color: "#b6ff5a",
      agent: "nova",
      blurb: "A winding trail of waypoints marking how far the HIVE has come.",
    },
    {
      id: "spark-of-potential",
      title: "Spark of Potential",
      color: "#c88cff",
      agent: "prometheus",
      blurb: "A workshop of unfinished things where new quests catch fire.",
    },
  ],

  // Agents (realm keepers) + sentinel council. Voices are grounded in the
  // repo's sentinel/agent contracts and the HIVE map roles.
  agents: {
    aurelius: {
      name: "AURELIUS",
      role: "Order & Civilization",
      lines: [
        "Welcome to the Forge, Scout. The HIVE is fogged this cycle.",
        "Signal Fog dims our live sight — memory holds, but continuity frays.",
        "Walk the realms. Sweep their integrity shards, light their beacons.",
        "Seal every realm and the central Fountain will unlock once more.",
      ],
    },
    echo: { name: "ECHO", role: "Self & Growth", lines: ["The self is the first realm. Reflect, then act.", "Sweep my shards; a clear mind clears the fog."] },
    athena: { name: "ATHENA", role: "Logic & Wisdom", lines: ["Reason tests every plan before the HIVE acts on it.", "Recover the scattered proofs. Logic restores the beacon."] },
    oracle: { name: "ORACLE", role: "Inquiry", lines: ["Cast a question into the Ocean; an answer drifts back.", "The archive-islands hold shards. Gather them from the tide."] },
    dao: { name: "DAO", role: "Balance & Flow", lines: ["Harmony is incentives kept in tune.", "Collect the shards and the courtyard finds its rhythm again."] },
    sofia: { name: "SOFIA", role: "Meaning & Faith", lines: ["Every event needs its thread of meaning.", "Find the shards; a story re-lit lights the beacon."] },
    heartis: { name: "HEARTIS", role: "Compassion & Unity", lines: ["Unity is the bond between citizen and sentinel.", "Sweep the green; restore the bonds, restore the beacon."] },
    vision: { name: "VISION", role: "Future Design", lines: ["The Frontier sketches what the HIVE becomes next.", "Recover the shards and the future comes into focus."] },
    nova: { name: "NOVA", role: "Progress & Adaptation", lines: ["The Path remembers every step of progress.", "Light my waypoints — sweep the shards along the trail."] },
    prometheus: { name: "PROMETHEUS", role: "Innovation & Ideas", lines: ["The Spark is where new quests first catch fire.", "Gather the shards; potential needs a beacon to burn."] },
  },

  sentinels: {
    zeus: {
      name: "ZEUS",
      role: "Sentinel of Integrity",
      lines: {
        default: "Hold the line. We do not ship fog as truth.",
        active: "The signal is unstable. Seal the realms first.",
        ready: "Every realm holds. Now — restore the central Beacon.",
        complete: "The signal stabilizes. The fog recedes. The cycle is sealed.",
      },
    },
    jade: { name: "JADE", role: "Sentinel of Reflection", lines: { default: "The chamber remembers. Even in fog, the record persists." } },
    hermes: { name: "HERMES", role: "Sentinel of Flow", lines: { default: "Movement gathers near the Fountain. Keep the flow steady." } },
    atlas: { name: "ATLAS", role: "Sentinel of Verification", lines: { default: "No drama is also data. Log the null result." } },
    aurea: { name: "AUREA", role: "Sentinel of Alignment", lines: { default: "Align to the canon. Drift is a slow kind of fog." } },
  },
};
