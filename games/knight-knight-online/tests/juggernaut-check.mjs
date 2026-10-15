// Who becomes the juggernaut: either knight, at random, whatever the score
import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
const tally = {behind: 0, ahead: 0, tieRed: 0, tieBlue: 0, red: 0, blue: 0};
for (let match = 0; match < 40; match++) {
    g.startOnlineMatch(500 + match, {...SETTINGS, arena: "MEADOW", roundsToWin: 10}, 0);
    // The bots are uneven on purpose some matches, so either side can be behind
    const bots = [makeBot(0, match), makeBot(1, match * 7 + 3)];
    let lastRound = 0;
    for (let t = 0; t < 200000 && g.phase !== "matchOver"; t++) {
        g.stepOnline(bots.map(bot => bot(g)));
        if (g.roundNumber !== lastRound) {
            lastRound = g.roundNumber;
            const big = g.knights.find(knight => knight.maxLives > 1);
            if (big !== undefined) {
                const color = big.player.color;
                const other = color === "red" ? "blue" : "red";
                tally[color]++;
                if (g.scores[color] < g.scores[other]) tally.behind++;
                else if (g.scores[color] > g.scores[other]) tally.ahead++;
                else tally[color === "red" ? "tieRed" : "tieBlue"]++;
            }
        }
    }
}
console.log(tally);
