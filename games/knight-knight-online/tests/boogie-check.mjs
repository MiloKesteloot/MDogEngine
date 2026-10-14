// The boogie bomb: the other knight dances for 5 seconds, can still walk, but can't attack. And how long the pause
// after a round is (with no replay).
import "./fake-browser.mjs";
import {SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
const EAST = 8, WEST = 4, SOUTH = 2, SWING = 16;
let failed = false;
const check = (what, good) => { console.log((good ? "ok   " : "FAIL ") + what); if (!good) failed = true; };

g.startOnlineMatch(2, {...SETTINGS, arena: "MEADOW", boulders: "OFF", hazards: false, killCam: "OFF"}, 0);
while (g.phase !== "playing") g.stepOnline([0, 0]);
g.givePowerup(0, "boogie");
const blue = () => g.knights[1];
check("blue is dancing", blue().danceTicks > 0);
const startY = blue().y;
let swung = false;
for (let t = 0; t < 4 * 160; t++) {
    // Down the right side of the field, where nothing's in the way
    g.stepOnline([0, (t < 80 ? SOUTH : 0) | (t % 20 === 0 ? SWING : 0)]);
    if (blue().state === "swing") swung = true;
}
check("blue can still walk while dancing (moved " + Math.round(blue().y - startY) + " pixels)", blue().y - startY > 25);
check("blue can't swing while dancing", !swung);
for (let t = 0; t < 1.2 * 160; t++) g.stepOnline([0, 0]);
check("the dance is over after 5 seconds", blue().danceTicks === 0);
g.stepOnline([0, SWING]);
g.stepOnline([0, 0]);
check("blue can swing again", blue().state === "swing");

// The pause after a round: blue's put right next to red, red knocks him down, then it's timed until the next round
const red = g.knights[0];
blue().x = red.x + 12;
blue().y = red.y;
for (let t = 0; t < 300 && g.phase === "playing"; t++) {
    g.stepOnline([EAST | (t % 30 === 0 ? SWING : 0), 0]);
}
check("the round ended", g.phase === "roundOver");
let ticks = 0;
while (g.phase === "roundOver") {
    g.stepOnline([0, 0]);
    ticks++;
}
console.log(`     from the knockdown to the next round: ${(ticks / 160).toFixed(1)} seconds`);
check("the next round started", g.phase === "ready");
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
