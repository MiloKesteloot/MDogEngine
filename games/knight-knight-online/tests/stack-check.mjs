// Power-ups stacking: shields (up to 3, a hit pops one), Big (bigger each time, up to 3x), sword throws (up to 3),
// and the rest just fill back up
import "./fake-browser.mjs";
import {SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
let failed = false;
const check = (what, good) => { console.log((good ? "ok   " : "FAIL ") + what); if (!good) failed = true; };
const SWING = 16, EAST = 8;
g.startOnlineMatch(3, {...SETTINGS, arena: "MEADOW", boulders: "OFF", hazards: false}, 0);
while (g.phase !== "playing") g.stepOnline([0, 0]);
const [red, blue] = g.knights;

for (let i = 0; i < 4; i++) g.givePowerup(1, "shield");
check(`four shields picked up makes three (${blue.shield})`, blue.shield === 3);
// Red walks up to blue and hits him: one shield pops
blue.x = red.x + 14; blue.y = red.y;
for (let t = 0; t < 200 && blue.shield === 3; t++) g.stepOnline([EAST | (t % 25 === 0 ? SWING : 0), 0]);
check(`a hit pops one shield, leaving two (${blue.shield}), and he's still up`, blue.shield === 2 && !blue.dead);

g.givePowerup(0, "grow");
for (let t = 0; t < 200; t++) g.stepOnline([0, 0]);
const once = red.scale;
g.givePowerup(0, "grow");
for (let t = 0; t < 200; t++) g.stepOnline([0, 0]);
const twice = red.scale;
g.givePowerup(0, "grow");
g.givePowerup(0, "grow");
for (let t = 0; t < 200; t++) g.stepOnline([0, 0]);
const most = red.scale;
check(`Big stacks: ${once} then ${twice} then ${most} (most is 3)`, once === 2 && twice === 2.5 && most === 3);
for (let t = 0; t < 9 * 160; t++) g.stepOnline([0, 0]);
check(`and when it runs out he's back to normal (${red.scale})`, red.scale === 1 && red.growLevel === 0);

g.givePowerup(0, "throw");
g.givePowerup(0, "throw");
check(`two Throw Swords is two throws (${red.throwCharges})`, red.throwCharges === 2);

g.givePowerup(0, "reverse");
for (let t = 0; t < 300; t++) g.stepOnline([0, 0]);
const left = blue.reverseTicks;
g.givePowerup(0, "reverse");
check(`another Reverse just fills it back up (${left} to ${blue.reverseTicks})`, blue.reverseTicks === 5 * 160);
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
