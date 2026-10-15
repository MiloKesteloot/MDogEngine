// Chicken rounds: they come up now and then (never on the bridge, sumo or the lighthouse), one knight starts as the
// chicken, every 10 seconds everything holds still for a second and they swap, a chicken never swings, no sword
// throws drop, and there's never a juggernaut at the same time. node chicken-round-check.mjs
import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
const TPS = 160;
let failed = false;
const fail = message => { failed = true; console.log("FAIL " + message); };
const tally = {rounds: 0, chickenRounds: 0, swaps: 0, arenas: {}, throws: 0, chickenSwings: 0, both: 0, chickenWins: 0};
for (let match = 0; match < 12; match++) {
    g.startOnlineMatch(900 + match, {...SETTINGS, roundsToWin: 10}, 0);
    const bots = [makeBot(0, match), makeBot(1, match * 5 + 2)];
    let lastRound = 0;
    let chickenWas = null;
    let freezeStart = null;
    for (let t = 0; t < 400000 && g.phase !== "matchOver"; t++) {
        g.stepOnline(bots.map(bot => bot(g)));
        if (g.roundNumber !== lastRound) {
            lastRound = g.roundNumber;
            tally.rounds++;
            if (g.chickenRound) {
                tally.chickenRounds++;
                tally.arenas[g.arenaName] = (tally.arenas[g.arenaName] ?? 0) + 1;
                if (["BRIDGE", "SUMO", "LIGHTHOUSE", "JOUST", "SHOWDOWN"].includes(g.arenaName)) fail("chicken round on " + g.arenaName);
                if (g.knights.filter(k => k.isChicken).length !== 1) fail("not exactly one chicken at the start");
                if (g.knights.some(k => k.maxLives > 1)) tally.both++;
            }
            chickenWas = g.knights.find(k => k.isChicken)?.player.color ?? null;
        }
        if (!g.chickenRound) continue;
        const s = g.captureState();
        if (s.powerups.some(p => p.type === "throw")) tally.throws++;
        for (const k of g.knights) if (k.isChicken && k.state === "swing") tally.chickenSwings++;
        if (g.chickenFreeze > 0 && freezeStart === null) freezeStart = t;
        const now = g.knights.find(k => k.isChicken && !k.dead)?.player.color ?? null;
        if (now !== null && chickenWas !== null && now !== chickenWas) {
            tally.swaps++;
            if (freezeStart === null || t - freezeStart < TPS - 2) fail("swapped without a second's freeze");
            freezeStart = null;
        }
        if (now !== null) chickenWas = now;
    }
}
console.log(JSON.stringify(tally));
if (tally.chickenRounds === 0) fail("no chicken rounds at all");
if (tally.swaps === 0) fail("never swapped");
if (tally.throws > 0) fail("a sword throw dropped in a chicken round");
if (tally.chickenSwings > 0) fail("a chicken swung");
if (tally.both > 0) fail("a juggernaut in a chicken round");
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
