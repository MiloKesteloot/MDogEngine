// Chickens: a little slower than a walking knight, and a peck knocks back instead of stunning
import "./fake-browser.mjs";
import {SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
const WEST = 4;
let failed = false;
const check = (what, good) => { console.log((good ? "ok   " : "FAIL ") + what); if (!good) failed = true; };

g.startOnlineMatch(4, {...SETTINGS, arena: "MEADOW", boulders: "OFF", hazards: false}, 0);
while (g.phase !== "playing") g.stepOnline([0, 0]);
const red = g.knights[0];
const blue = g.knights[1];
// A chicken just to the right of blue, who's standing still
const chicken = new g.CLASSES.Chicken(blue.getGroundX() + 14, blue.getGroundY());
g.captureState().features.push(chicken);
let pecked = null;
for (let t = 0; t < 160 && pecked === null; t++) {
    const before = blue.getGroundX();
    g.stepOnline([0, 0]);
    if (chicken.peckCooldown > 0) {
        pecked = t;
    }
}
check("the chicken pecked blue", pecked !== null);
check("blue isn't stunned", blue.stunTicks === 0);
const x = blue.getGroundX();
for (let t = 0; t < 40; t++) g.stepOnline([0, 0]);
check(`blue was knocked back, away from the chicken (${Math.round(x - blue.getGroundX())} pixels)`, x - blue.getGroundX() > 8);

// Red walks away from a chicken right behind him: he gets further away
const chaser = new g.CLASSES.Chicken(red.getGroundX() + 20, red.getGroundY());
g.captureState().features.push(chaser);
for (let t = 0; t < 10; t++) g.stepOnline([WEST, 0]);
const gapBefore = chaser.x - red.getGroundX();
for (let t = 0; t < 120; t++) g.stepOnline([WEST, 0]);
const gapAfter = chaser.x - red.getGroundX();
check(`a walking knight slowly gets away from a chicken (gap ${gapBefore.toFixed(1)} to ${gapAfter.toFixed(1)} pixels)`, gapAfter > gapBefore);
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
