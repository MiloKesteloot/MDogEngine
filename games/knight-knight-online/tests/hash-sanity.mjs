// The fingerprint has to notice the smallest difference, or the sync tests would pass when they shouldn't
import "./fake-browser.mjs";
import {SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
g.startOnlineMatch(5, SETTINGS, 0);
for (let i = 0; i < 400; i++) g.stepOnline([8, 4]);
const before = g.hashState(g.captureState(), g.skipInHash);
const copy = g.cloneState(g.captureState());
g.knights[0].x += 1e-13;
const nudged = g.hashState(g.captureState(), g.skipInHash);
g.restoreState(copy);
const restored = g.hashState(g.captureState(), g.skipInHash);
// A copy has to be its own thing: changing the game mustn't change a saved copy
const saved = g.cloneState(g.captureState());
const savedHash = g.hashState(saved, g.skipInHash);
for (let i = 0; i < 50; i++) g.stepOnline([1, 2]);
const ok = before !== nudged && before === restored && g.hashState(saved, g.skipInHash) === savedHash
    && saved.knights[0] !== g.knights[0] && Object.getPrototypeOf(saved.knights[0]) === Object.getPrototypeOf(g.knights[0]);
console.log({before, nudged, restored}, ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
