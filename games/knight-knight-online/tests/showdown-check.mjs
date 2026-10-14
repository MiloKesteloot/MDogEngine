// The showdown: one of three layouts each time, and nothing but the two knights (and their guns), the crates, rocks
// and barrels, tumbleweeds and the weather. Everything that could add something else is turned up.
import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
let failed = false;
const check = (what, good) => { console.log((good ? "ok   " : "FAIL ") + what); if (!good) failed = true; };

const settings = {...SETTINGS, arena: "SHOWDOWN", boulders: "LOTS", hazards: true, weather: true, shiftingGround: true, juggernaut: true, roundsToWin: 10};
g.startOnlineMatch(21, settings, 0);
const bots = [makeBot(0, 4), makeBot(1, 5)];
const layouts = new Set();
const weathers = new Set();
const extras = new Set();
const allowedFeatures = new Set(["Barrel", "Explosion", "TumbleweedSpawner", "Tumbleweed"]);
let tumbleweeds = 0;
let rounds = 0;
let lastRound = 0;
for (let t = 0; t < 400000 && rounds < 30; t++) {
    g.stepOnline(bots.map(bot => bot(g)));
    const s = g.captureState();
    if (g.roundNumber !== lastRound) {
        rounds++;
        lastRound = g.roundNumber;
        layouts.add(s.arena.layouts.indexOf(s.arenaLayout));
    }
    weathers.add(s.weather.kind);
    if (s.boulders.length || s.incoming.length) extras.add("boulders");
    if (s.powerups.length) extras.add("power-ups");
    if (s.skyRocks.length) extras.add("catapult rocks");
    if (s.horses.length) extras.add("horses");
    if (s.strikes.length) extras.add("lightning strikes");
    if (s.holes.length) extras.add("holes");
    for (const feature of s.features) {
        if (!allowedFeatures.has(feature.constructor.name)) extras.add(feature.constructor.name);
        if (feature.constructor.name === "Tumbleweed" && feature.ticks === 1) tumbleweeds++;
    }
    if (s.knights.some(k => k.maxLives > 1)) extras.add("juggernaut");
}
check(`all three layouts came up in ${rounds} rounds (${[...layouts].sort().join(", ")})`, layouts.size === 3 && !layouts.has(-1));
check("nothing extra ever showed up" + (extras.size ? ": " + [...extras].join(", ") : ""), extras.size === 0);
check(`the weather was only ever ${[...weathers].join(", ")}`, [...weathers].every(kind => ["clear", "wind", "rain"].includes(kind)));
check(`tumbleweeds rolled by (${tumbleweeds})`, tumbleweeds > 0);
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
