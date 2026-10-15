// No holes ever open in the mine. node mine-holes-check.mjs
import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
g.startOnlineMatch(31, {...SETTINGS, arena: "MINE", roundsToWin: 10}, 0);
const bots = [makeBot(0, 5), makeBot(1, 6)];
let holes = 0, rounds = new Set(), modifiers = new Set();
for (let t = 0; t < 120000 && g.phase !== "matchOver"; t++) {
    g.stepOnline(bots.map(bot => bot(g)));
    const s = g.captureState();
    holes = Math.max(holes, s.holes.length);
    rounds.add(g.roundNumber);
    if (s.roundModifier) modifiers.add(s.roundModifier);
}
console.log("rounds " + rounds.size + ", round 2's twist: " + ([...modifiers].join(", ") || "none") + ", most holes at once: " + holes);
const good = holes === 0 && !modifiers.has("holes");
console.log(good ? "PASS" : "FAILED");
process.exit(good ? 0 : 1);
