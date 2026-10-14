// The volcano: dragons come every 7 to 13 seconds, and a knight standing on a fissure's crack falls in when it opens
// (how fissures box the knights in is boxin-check.mjs)
import "./fake-browser.mjs";
import {SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
let failed = false;
const check = (what, good) => { console.log((good ? "ok   " : "FAIL ") + what); if (!good) failed = true; };
const kinds = name => g.captureState().features.filter(f => f.constructor.name === name);
const fissures = () => g.captureState().holes.filter(h => h.constructor.name === "Fissure");

g.startOnlineMatch(12, {...SETTINGS, arena: "VOLCANO", boulders: "OFF", roundsToWin: 10}, 0);
while (g.phase !== "playing") g.stepOnline([0, 0]);
// Both knights are kept out of the way (and can't be hurt), to watch for a while
const keepSafe = () => g.knights.forEach(k => { k.graceTicks = 10; k.x = -100; });

const seen = {cracking: 0, open: 0, closed: 0, dragons: 0};
let dragonsBefore = new Set();
const dragonTimes = [];
let last = null;
for (let t = 0; t < 60 * 160; t++) {
    keepSafe();
    g.stepOnline([0, 0]);
    const f = fissures()[0];
    if (f && f.state !== last) {
        seen[f.state === "cracking" ? "cracking" : f.state === "open" ? "open" : "other"] = (seen[f.state] ?? 0) + 1;
    }
    if (!f && last !== null) seen.closed++;
    last = f ? f.state : null;
    for (const dragon of kinds("Dragon")) {
        if (!dragonsBefore.has(dragon.ticks === 1 ? dragon : null) && dragon.ticks === 1) {
            dragonTimes.push(t / 160);
        }
    }
}
const gaps = dragonTimes.slice(1).map((time, i) => time - dragonTimes[i]);
check(`dragons came ${dragonTimes.length} times in a minute, ${gaps.map(gap => gap.toFixed(1)).join(", ")} seconds apart`,
    dragonTimes.length >= 4 && gaps.every(gap => gap >= 6.9 && gap <= 13.1));

// A knight standing where a fissure opens falls in
g.startOnlineMatch(13, {...SETTINGS, arena: "VOLCANO", boulders: "OFF", hazards: false, roundsToWin: 10}, 0);
while (g.phase !== "playing") g.stepOnline([0, 0]);
let f = null;
for (let t = 0; t < 20 * 160 && !f; t++) {
    g.knights.forEach(k => { k.x = -100; });
    g.stepOnline([0, 0]);
    f = fissures()[0];
}
const red = g.knights[0];
const spot = f.getFallSpot(96, 96);
red.x = spot.x - 10;
red.y = spot.y - 16;
g.knights[1].x = 200;
g.knights[1].y = 150;
check("a knight on the crack is fine while it's only cracking", !red.dead);
for (let t = 0; t < 3 * 160 && !red.dead; t++) g.stepOnline([0, 0]);
check("he falls in when it opens", red.dead && red.fallHole === f);
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
