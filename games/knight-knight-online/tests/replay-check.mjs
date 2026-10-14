// Online kill cam: do replays happen, and do they end?
import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
g.startOnlineMatch(9, {...SETTINGS, roundsToWin: 5}, 0);
const bots = [makeBot(0, 1), makeBot(1, 2)];
let replays = 0, replayTicks = 0, was = 0;
for (let t = 0; t < 60000; t++) {
    // No swinging during replays, so they play all the way through
    const bits = bots.map(bot => g.replayTicksLeft > 0 ? 0 : bot(g));
    g.stepOnline(bits);
    if (g.replayTicksLeft > 0 && was === 0) replays++;
    if (g.replayTicksLeft > 0) replayTicks++;
    was = g.replayTicksLeft;
}
console.log({replays, averageLength: Math.round(replayTicks / Math.max(1, replays)), round: g.roundNumber});
process.exit(replays > 0 ? 0 : 1);
