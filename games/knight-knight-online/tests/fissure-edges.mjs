// Fissures reach right across the field, edge to edge, and where you fall in is exactly where the lava's drawn
import "./fake-browser.mjs";
import {SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
let failed = false;
const check = (what, good) => { console.log((good ? "ok   " : "FAIL ") + what); if (!good) failed = true; };

g.startOnlineMatch(5, {...SETTINGS, arena: "VOLCANO"}, 0);
const seen = new Set();
for (let tries = 0; tries < 40 && seen.size < 2; tries++) {
    const fissure = new g.CLASSES.Fissure();
    if (seen.has(fissure.axis)) continue;
    seen.add(fissure.axis);
    fissure.width = 12;
    const [length, across] = fissure.axis === "x" ? [240, "left and right"] : [180, "top and bottom"];
    check(`a ${fissure.axis === "x" ? "side to side" : "up and down"} fissure is drawn past the ${across} edges (${fissure.start} to ${fissure.end})`,
        fissure.start <= 0 && fissure.end >= length);
    // Anywhere along it, the middle of the lava is lava, and well outside it isn't
    let mismatch = null;
    for (let along = 0; along < length; along++) {
        const middle = fissure.getFallSpot(along, along);
        const outside = fissure.axis === "x" ? {x: along, y: middle.y + 10} : {x: middle.x + 10, y: along};
        if (!fissure.contains(middle.x, middle.y) || fissure.contains(outside.x, outside.y)) {
            mismatch = along;
            break;
        }
    }
    check("where you fall in matches where the lava is, all the way along" + (mismatch !== null ? " (not at " + mismatch + ")" : ""), mismatch === null);
}
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
