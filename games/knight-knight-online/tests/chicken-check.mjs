// Chickens: none in rounds 1 and 2, and from round 3 one comes after a minute with nobody hit
import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
const chickens = () => g.captureState().features.filter(f => f.constructor.name === "Chicken").length;
g.startOnlineMatch(8, {...SETTINGS, arena: "MEADOW", roundsToWin: 10, boulders: "OFF"}, 0);
while (g.phase !== "playing") g.stepOnline([0, 0]);
for (let t = 0; t < 120 * 160; t++) g.stepOnline([0, 0]);
console.log("round", g.roundNumber, "after 2 idle minutes:", chickens(), "chickens");
const bots = [makeBot(0, 1), makeBot(1, 2)];
while (g.roundNumber < 3) g.stepOnline(bots.map(bot => bot(g)));
for (let tries = 0; tries < 6; tries++) {
    while (g.phase !== "playing") g.stepOnline([0, 0]);
    const round = g.roundNumber;
    const state = g.captureState();
    if (tries === 1) {
        // Nothing else that attacks this round, to see the chicken come
        state.roundHazards = [];
        state.features = state.features.filter(f => !["Storm", "Bear"].includes(f.constructor.name));
        g.restoreState(state);
    }
    let firstAt = null, endedAt = null;
    for (let t = 0; t < 75 * 160 && firstAt === null; t++) {
        g.stepOnline([0, 0]);
        if (chickens() > 0) firstAt = t / 160;
        if (g.phase !== "playing" && endedAt === null) { endedAt = t / 160; break; }
    }
    const s = g.captureState();
    console.log(`round ${round}: hazards ${JSON.stringify(state.roundHazards)}, first chicken ${firstAt}s, round ended by something else at ${endedAt}s, calm ${(s.calmTicks / 160).toFixed(1)}s`);
    if (firstAt !== null) break;
    while (g.roundNumber === round) g.stepOnline([0, 0]);
}
