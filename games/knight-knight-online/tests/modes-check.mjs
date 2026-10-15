// Game modes with normal rounds turned off: every round is one of the modes that are on (and on an arena it works
// on), falling back to normal rounds if none can be played, with two copies of the game staying in sync.
// node modes-check.mjs
import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
const a = (await import("../knight-knight-online.js?copy=a")).testHooks;
const b = (await import("../knight-knight-online.js?copy=b")).testHooks;
let failed = false;
const check = (what, good) => { if (!good) failed = true; console.log((good ? "ok   " : "FAIL ") + what); };
const ALL_ARENAS = ["MEADOW", "RIVER", "SNOW", "VOLCANO", "FOREST", "MINE", "LIGHTHOUSE", "BRIDGE", "LAVALAKE", "RING", "STORM", "SUMO", "SHIP", "SHOWDOWN", "JOUST"];
const only = names => Object.fromEntries(ALL_ARENAS.map(name => [name, names.includes(name)]));

// Plays rounds with these settings, and returns what each round was: like "MEADOW chicken"
function play(settings, seed, rounds = 12) {
    a.startOnlineMatch(seed, {...SETTINGS, roundsToWin: 10, ...settings}, 0);
    b.startOnlineMatch(seed, {...SETTINGS, roundsToWin: 10, ...settings}, 1);
    const bots = [makeBot(0, seed), makeBot(1, seed + 1)];
    const seen = [];
    let lastRound = 0;
    for (let t = 0; t < 400000 && seen.length < rounds && a.phase !== "matchOver"; t++) {
        const bits = bots.map(bot => bot(a));
        a.stepOnline(bits);
        b.stepOnline(bits);
        if (a.roundNumber !== lastRound) {
            lastRound = a.roundNumber;
            const what = a.chickenRound ? "chicken" : a.knights.some(k => k.maxLives > 1) ? "juggernaut"
                : a.arenaName === "SHOWDOWN" ? "showdown" : a.arenaName === "JOUST" ? "joust" : "normal";
            seen.push(a.arenaName + " " + what);
        }
        if (t % 500 === 0 && a.hashState(a.captureState(), a.skipInHash) !== b.hashState(b.captureState(), b.skipInHash)) {
            check("the two copies drifted apart at tick " + t, false);
            break;
        }
    }
    return seen;
}
const kinds = seen => [...new Set(seen.map(round => round.split(" ")[1]))].sort().join(",");

let seen = play({normalRounds: false, juggernaut: false, chickenRounds: true, arenas: only(ALL_ARENAS.filter(n => n !== "SHOWDOWN" && n !== "JOUST"))}, 21);
check("only chickens: every round's a chicken round (" + seen.length + " rounds)", kinds(seen) === "chicken");
check("and never on the bridge, sumo or lighthouse", !seen.some(round => /^(BRIDGE|SUMO|LIGHTHOUSE) /.test(round)));

seen = play({normalRounds: false, juggernaut: true, chickenRounds: false, arenas: only(ALL_ARENAS.filter(n => n !== "SHOWDOWN" && n !== "JOUST"))}, 22);
check("only juggernauts: every round has one (" + seen.length + " rounds)", kinds(seen) === "juggernaut");
check("and never in sumo", !seen.some(round => round.startsWith("SUMO ")));

seen = play({normalRounds: false, juggernaut: false, chickenRounds: false, arenas: only(["MEADOW", "SHOWDOWN"])}, 23, 6);
check("only showdowns: " + [...new Set(seen)].join(", "), kinds(seen) === "showdown");

seen = play({normalRounds: false, juggernaut: false, chickenRounds: true, arenas: only(ALL_ARENAS)}, 24, 16);
check("chickens and jousts and showdowns, no normal rounds: " + kinds(seen), kinds(seen) === "chicken,joust,showdown");

seen = play({normalRounds: false, juggernaut: false, chickenRounds: true, arenas: only(["SUMO"])}, 25, 4);
check("only chickens but only sumo on: it falls back to normal rounds: " + [...new Set(seen)].join(", "), kinds(seen) === "normal");

seen = play({}, 26, 12);
check("the defaults still start normal: " + seen.slice(0, 2).join(", "), seen[0] === "MEADOW normal");

console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
