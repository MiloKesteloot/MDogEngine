// The volcano's fissures box the knights in: each new one is well away from both knights, with both on the same side;
// they stay open, so the field shrinks (but never too small); power-ups never turn up in a part that's cut off; and
// if a knight crosses a crack before it opens, that one closes up again instead of staying.
import "./fake-browser.mjs";
import {SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
let failed = false;
const check = (what, good) => { console.log((good ? "ok   " : "FAIL ") + what); if (!good) failed = true; };
const fissures = () => g.captureState().holes.filter(hole => hole.constructor.name === "Fissure");
const settings = {...SETTINGS, arena: "VOLCANO", boulders: "OFF", hazards: false, roundsToWin: 10};

// ----- Boxing in -----
g.startOnlineMatch(31, settings, 0);
while (g.phase !== "playing") g.stepOnline([0, 0]);
const [red, blue] = g.knights;
const place = () => {
    // Standing still near the middle, where nothing can hurt them
    red.x = 92; red.y = 80;
    blue.x = 128; blue.y = 80;
    for (const knight of g.knights) knight.graceTicks = 10;
};
const seen = new Set();
const problems = [];
let cutOffPowerups = 0;
for (let t = 0; t < 120 * 160; t++) {
    place();
    g.stepOnline([0, 0]);
    for (const fissure of fissures()) {
        if (!seen.has(fissure)) {
            seen.add(fissure);
            for (const knight of g.knights) {
                const distance = fissure.distanceFrom(knight.getGroundX(), knight.getGroundY());
                if (distance < 30) problems.push(`a new fissure was only ${distance.toFixed(1)} from a knight`);
            }
            const sides = new Set(g.knights.map(knight => fissure.sideOf(knight.getGroundX(), knight.getGroundY())));
            if (sides.size !== 1) problems.push("a new fissure had the knights on different sides");
        }
        if (fissure.state === "closing" || fissure.done) problems.push("a fissure closed, though the knights were on the same side");
        if (fissure.keepSide !== null && g.knights.some(knight => fissure.sideOf(knight.getGroundX(), knight.getGroundY()) !== fissure.keepSide)) {
            problems.push("a knight was on the cut off side");
        }
    }
    // No power-up (old or new) is ever left in a part that's cut off, or in the lava
    for (const powerup of g.captureState().powerups) {
        if (fissures().some(fissure => fissure.state === "open" && (fissure.isCutOff(powerup.x, powerup.y) || fissure.contains(powerup.x, powerup.y)))) cutOffPowerups++;
    }
}
const open = fissures().filter(fissure => fissure.permanent && fissure.keepSide !== null);
check(`fissures kept coming and stayed open (${open.length} after two minutes)`, open.length >= 3);
check("every one was well away from both knights, with them on the same side, and none closed" + (problems.length ? ": " + [...new Set(problems)].join("; ") : ""), problems.length === 0);
// What's left of the field
let area = {left: 0, right: 240, top: 20, bottom: 180};
for (const fissure of open) {
    const [low, high] = fissure.getExtent();
    if (fissure.axis === "y") fissure.keepSide > 0 ? area.left = Math.max(area.left, high) : area.right = Math.min(area.right, low);
    else fissure.keepSide > 0 ? area.top = Math.max(area.top, high) : area.bottom = Math.min(area.bottom, low);
}
const width = area.right - area.left;
const height = area.bottom - area.top;
check(`the field was boxed in to ${Math.round(width)} by ${Math.round(height)} (from 240 by 160), but no smaller than 90 by 70`, width >= 90 && height >= 70 && width * height < 240 * 160 * 0.6);
check(`no power-ups were ever left in the lava or a part that's cut off (${cutOffPowerups})`, cutOffPowerups === 0);

// ----- A knight crossing over before it opens -----
g.startOnlineMatch(32, settings, 0);
while (g.phase !== "playing") g.stepOnline([0, 0]);
let fissure = null;
for (let t = 0; t < 30 * 160 && fissure === null; t++) {
    g.knights[0].x = 92; g.knights[0].y = 80;
    g.knights[1].x = 128; g.knights[1].y = 80;
    g.stepOnline([0, 0]);
    fissure = fissures()[0] ?? null;
}
// Red goes over to the other side of the crack while it's still cracking
const crossed = g.knights[0];
const other = fissure.axis === "y" ? {x: fissure.centerAt(96) + (fissure.sideOf(crossed.getGroundX(), crossed.getGroundY()) > 0 ? -20 : 20), y: 96}
    : {x: 120, y: fissure.centerAt(120) + (fissure.sideOf(crossed.getGroundX(), crossed.getGroundY()) > 0 ? -20 : 20)};
crossed.x = other.x - 10;
crossed.y = other.y - 16;
for (const knight of g.knights) knight.graceTicks = 10;
let closed = false;
for (let t = 0; t < 10 * 160 && !closed; t++) {
    for (const knight of g.knights) knight.graceTicks = 10;
    g.stepOnline([0, 0]);
    closed = fissure.done;
}
check("with the knights on different sides when it opened, it didn't stay: it closed up again", closed && !fissure.permanent);
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
