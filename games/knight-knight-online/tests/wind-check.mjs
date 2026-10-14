// No wind on arenas you can be pushed off (into the sea, the canyon, off the sumo platform or a raft), even as
// round 2's twist. Other arenas still get it.
import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
let failed = false;
const check = (what, good) => { console.log((good ? "ok   " : "FAIL ") + what); if (!good) failed = true; };

for (const arena of ["LIGHTHOUSE", "SUMO", "BRIDGE", "LAVALAKE", "MEADOW"]) {
    const weathers = new Set();
    // Lots of matches, so round 2's twist comes up plenty of times
    for (let match = 0; match < 12; match++) {
        g.startOnlineMatch(100 + match, {...SETTINGS, arena, roundsToWin: 4}, 0);
        const bots = [makeBot(0, match), makeBot(1, match + 50)];
        for (let t = 0; t < 60000 && g.phase !== "matchOver"; t++) {
            g.stepOnline(bots.map(bot => bot(g)));
            weathers.add(g.captureState().weather.kind);
        }
    }
    if (arena === "MEADOW") {
        check(`${arena} still gets wind sometimes (${[...weathers].join(", ")})`, weathers.has("wind"));
    } else {
        check(`${arena} never has wind (${[...weathers].join(", ")})`, !weathers.has("wind"));
    }
}
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
