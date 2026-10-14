// A copy of the game sent as JSON has to come back exactly the same, through every arena
import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
import {serializeState, deserializeState} from "../Snapshot.js";
const g = (await import("../knight-knight-online.js")).testHooks;
let failed = 0, biggest = 0;
for (const arena of ["MIXED", "MEADOW", "RIVER", "SNOW", "VOLCANO", "FOREST", "MINE", "LIGHTHOUSE", "BRIDGE", "LAVALAKE", "RING", "STORM", "SUMO", "SHIP", "SHOWDOWN", "JOUST"]) {
    g.startOnlineMatch(31, {...SETTINGS, arena}, 0);
    const bots = [makeBot(0, 5), makeBot(1, 6)];
    for (let t = 1; t <= 6000; t++) {
        g.stepOnline(bots.map(bot => bot(g)));
        if (t % 500 === 0) {
            const copy = g.cloneState(g.captureState());
            const text = JSON.stringify(serializeState(copy, g.CLASSES, g.frozenThings.names));
            biggest = Math.max(biggest, text.length);
            const back = deserializeState(JSON.parse(text), g.CLASSES, g.frozenThings.byName);
            const before = g.hashState(copy, g.skipInHash);
            if (g.hashState(back, g.skipInHash) !== before) {
                console.log("FAIL " + arena + " at tick " + t);
                failed++;
                break;
            }
            // And the game carries on the same from it
            const ahead = [];
            for (let i = 0; i < 200; i++) ahead.push(bots.map(bot => bot(g)));
            const saved = g.cloneState(g.captureState());
            for (const bits of ahead) g.stepOnline(bits);
            const direct = g.hashState(g.captureState(), g.skipInHash);
            g.restoreState(back);
            for (const bits of ahead) g.stepOnline(bits);
            if (g.hashState(g.captureState(), g.skipInHash) !== direct) {
                console.log("FAIL " + arena + ": playing on from the sent copy came out different, tick " + t);
                failed++;
                break;
            }
        }
    }
}
console.log("biggest copy " + Math.round(biggest / 1024) + " KB");
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
