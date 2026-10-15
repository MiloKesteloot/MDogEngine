// A long mixed match between two copies, to reach the rare stuff (juggernauts, showdowns, jousts, chickens...)
import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
const ticks = Number(process.argv[2] ?? 100000);
const a = (await import("../knight-knight-online.js?copy=a")).testHooks;
const b = (await import("../knight-knight-online.js?copy=b")).testHooks;
const settings = {...SETTINGS, roundsToWin: 10};
a.startOnlineMatch(77, settings, 0);
b.startOnlineMatch(77, settings, 1);
const bots = [makeBot(0, 3), makeBot(1, 4)];
const seen = new Set();
let matches = 0, lastPhase = null;
for (let t = 0; t < ticks; t++) {
    const bits = bots.map(bot => bot(a));
    a.stepOnline(bits);
    b.stepOnline(bits);
    seen.add(a.arenaName + (a.knights.some(k => k.maxLives > 1) ? "+juggernaut" : "") + (a.chickenRound ? "+chicken" : ""));
    if (a.phase === "matchOver" && lastPhase !== "matchOver") matches++;
    lastPhase = a.phase;
    if (t % 250 === 0 && a.hashState(a.captureState(), a.skipInHash) !== b.hashState(b.captureState(), b.skipInHash)) {
        console.log("FAIL: drifted apart at tick", t, a.arenaName, "round", a.roundNumber);
        process.exit(1);
    }
}
console.log("matches finished", matches, "round", a.roundNumber, "seen", [...seen].sort().join(", "));
console.log("PASS");
