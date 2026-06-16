/**
 * Solo game — no authoritative server logic needed. The Higgsfield apps
 * engine requires a code module at the zip root; this is the documented
 * single-player stub. All gameplay lives client-side in game.js.
 */
export const meta = { game: "mobius-hive-world-simulator", minPlayers: 1, maxPlayers: 1 };
export function setup() { return {}; }
export function validateAction() { return { ok: true }; }
export function applyAction(state) { return state; }
export function isGameOver() { return { over: false }; }
export function viewFor(state) { return state; }
