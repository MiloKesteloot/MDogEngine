// A knight facing right who spams swing while holding down should turn to face down for his next swing
import "./fake-browser.mjs";
import {SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
const EAST = 8, SOUTH = 2, SWING = 16;
g.startOnlineMatch(1, {...SETTINGS, arena: "MEADOW", boulders: "OFF"}, 0);
while (g.phase !== "playing") g.stepOnline([0, 0]);
for (let t = 0; t < 20; t++) g.stepOnline([EAST, 0]); // walking right, so facing right
const red = () => g.knights[0];
console.log("before:", red().facing);
// Spam swing (every 10 ticks) while holding down
const facings = [];
for (let t = 0; t < 400; t++) {
    g.stepOnline([SOUTH | (t % 10 === 0 ? SWING : 0), 0]);
    if (red().state === "swing") facings.push(red().facing);
}
const last = facings.at(-1);
console.log("swinging while holding down, facing:", [...new Set(facings)].join(" then "));
console.log(last === "south" ? "PASS" : "FAIL");
process.exit(last === "south" ? 0 : 1);
