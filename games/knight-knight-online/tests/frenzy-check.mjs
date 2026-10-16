// The frenzy power-up drops 12 power-ups all over, none within 24 pixels of a knight, and comes up a third as often
// as each of the others. And after a round's decided, the winner can still go down (without the score changing).
// node frenzy-check.mjs
import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
let failed = false;
const check = (what, good) => { if (!good) failed = true; console.log((good ? "ok   " : "FAIL ") + what); };
const quiet = {...SETTINGS, arena: "MEADOW", boulders: "OFF", hazards: false, roundsToWin: 10};

// The shower
g.startOnlineMatch(41, quiet, 0);
while (g.phase !== "playing") g.stepOnline([0, 0]);
let s = g.captureState();
s.powerups = [];
g.restoreState(s);
const feet = g.knights.map(k => ({x: k.getGroundX(), y: k.getGroundY()}));
g.givePowerup(0, "frenzy");
s = g.captureState();
const drops = s.powerups;
check(drops.length + " power-ups dropped", drops.length === 12);
const nearest = Math.min(...drops.flatMap(p => feet.map(f => Math.hypot(p.x - f.x, p.y - f.y))));
check("the nearest is " + nearest.toFixed(1) + " pixels from a knight", nearest >= 24);
const types = [...new Set(drops.map(p => p.type))];
check("they're a mix (" + types.join(", ") + "), and no frenzies", types.length > 3 && !types.includes("frenzy"));
check("they come down one after another", new Set(drops.map(p => p.delay)).size === 12 && drops.every(p => !p.isLanded()));
for (let t = 0; t < 2 * 160; t++) g.stepOnline([0, 0]);
check("and all land within 2 seconds", g.captureState().powerups.every(p => p.isLanded()));

// How often each kind shows up (bots playing a long match on the meadow)
const counts = {};
g.startOnlineMatch(42, {...quiet, roundsToWin: 99}, 0);
const bots = [makeBot(0, 1), makeBot(1, 2)];
let last = new Set();
for (let t = 0; t < 1500000; t++) {
    g.stepOnline(bots.map(bot => bot(g)));
    const now = g.captureState().powerups;
    // A new one on its own (not a frenzy's shower)
    if (now.length === 1 && !last.has(now[0])) counts[now[0].type] = (counts[now[0].type] ?? 0) + 1;
    last = new Set(now);
}
const others = Object.entries(counts).filter(([type]) => type !== "frenzy").map(([, n]) => n);
const average = others.reduce((a, b) => a + b, 0) / others.length;
const ratio = average / (counts.frenzy ?? 0.0001);
console.log("     " + JSON.stringify(counts));
check("each other kind shows up " + ratio.toFixed(1) + " times as often as frenzy", ratio > 2 && ratio < 4.5);

// Going down after the round's decided: blue falls in the lava, then red walks in too
g.startOnlineMatch(43, {...quiet, arena: "VOLCANO"}, 0);
while (g.phase !== "playing") g.stepOnline([0, 0]);
const [red, blue] = g.knights;
blue.x = 120 - 10; blue.y = 92 - 16;
for (let t = 0; t < 20 && g.phase === "playing"; t++) g.stepOnline([0, 0]);
check("blue fell in and red scored", g.phase === "roundOver" && g.scores.red === 1);
red.x = 120 - 10; red.y = 92 - 16;
for (let t = 0; t < 2 * 160 && !red.dead; t++) g.stepOnline([0, 0]); // (after the knockdown's freeze)
check("red can still fall in the lava after winning the round", red.dead);
check("and the score's still 1-0", g.scores.red === 1 && g.scores.blue === 0 && g.phase === "roundOver");
for (let t = 0; t < 8 * 160 && g.roundNumber === 1; t++) g.stepOnline([0, 0]);
check("the next round starts as usual", g.roundNumber === 2 && g.knights.every(k => !k.dead));

console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
