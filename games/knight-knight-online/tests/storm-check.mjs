// The storm arena's wild storm: how often strikes come, and how close to the knights they land
import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
const g = (await import("../knight-knight-online.js")).testHooks;
g.startOnlineMatch(3, {...SETTINGS, arena: "STORM", roundsToWin: 10}, 0);
const bots = [makeBot(0, 1), makeBot(1, 2)];
let stormTicks = 0, strikes = 0, on = 0, near = 0, far = 0;
for (let t = 0; t < 200000 && stormTicks < 160 * 120; t++) {
    g.stepOnline(bots.map(bot => bot(g)));
    const state = g.captureState();
    if (state.features.some(f => f.wild) && state.phase === "playing") {
        stormTicks++;
        for (const strike of state.strikes) {
            if (strike.ticks === 1 && strike.target === null) {
                strikes++;
                const closest = Math.min(...state.knights.filter(k => !k.dead).map(k => Math.hypot(k.getGroundX() - strike.x, k.getGroundY() - strike.y)));
                if (closest < 13) on++; else if (closest < 40) near++; else far++;
            }
        }
    }
}
console.log({secondsOfStorm: Math.round(stormTicks / 160), strikes, perSecond: (strikes / (stormTicks / 160)).toFixed(2), on, near, far});
