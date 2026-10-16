// Tall grass gets cut by more than swords: lightning and rolling boulders. And a chicken that goes down stays a
// chicken (it's drawn as a roast). node grass-check.mjs
import "./fake-browser.mjs";
import {SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
let failed = false;
const check = (what, good) => { if (!good) failed = true; console.log((good ? "ok   " : "FAIL ") + what); };
const cutCount = () => g.captureState().grassRows.reduce((sum, row) => sum + row.cut.size, 0);
const start = () => {
    g.startOnlineMatch(51, {...SETTINGS, arena: "MEADOW", boulders: "OFF", hazards: false, roundsToWin: 10}, 0);
    while (g.phase !== "playing") g.stepOnline([0, 0]);
};

// Lightning in the middle of a patch of tall grass
start();
let [left, top, right, bottom] = g.captureState().arena.tallGrass[0];
let before = cutCount();
g.strikeAt((left + right) / 2, (top + bottom) / 2);
for (let t = 0; t < 3 * 160; t++) g.stepOnline([0, 0]);
check("lightning cut " + (cutCount() - before) + " blades of tall grass", cutCount() - before > 5);

// A boulder rolling along through it
start();
before = cutCount();
let s = g.captureState();
const boulder = new g.CLASSES.Boulder();
boulder.x = left - 30; boulder.y = (top + bottom) / 2 - 6; boulder.landed = true; boulder.setDirection(1, 0);
s.boulders.push(boulder);
g.knights.forEach(k => { k.y = 160; });
g.restoreState(s);
for (let t = 0; t < 3 * 160; t++) g.stepOnline([0, 0]);
check("a rolling boulder cut " + (cutCount() - before) + " blades", cutCount() - before > 10);

// A chicken knocked down is still a chicken (a roast one)
start();
s = g.captureState();
s.chickenRound = true;
s.knights[1].setChicken(true);
g.restoreState(s);
const blue = g.knights[1];
blue.x = 120 - 10; blue.y = 140 - 16;
g.knights[0].x = 108 - 10; g.knights[0].y = 140 - 16; g.knights[0].facing = "east";
for (let t = 0; t < 160 && !blue.dead; t++) g.stepOnline(t === 2 ? [16, 0] : [0, 0]);
check("red's sword knocked the chicken down", blue.dead);
check("and it's still a chicken, for the roast", blue.isChicken === true && blue.bleeding === false);

console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
