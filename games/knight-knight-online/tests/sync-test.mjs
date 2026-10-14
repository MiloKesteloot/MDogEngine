// Checks the game is deterministic, which online play depends on. Run with: node sync-test.mjs [ticks per arena]
//
// 1. Two copies of the game, given the same seed and the same key presses, have to stay exactly the same (their
//    fingerprints are compared every 100 ticks), through every arena.
// 2. Going back to a saved copy and playing the same ticks again has to come out exactly the same as the first time
//    (that's what rollback does), with sounds and particles off the second time, like online.

import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";

const ticksPerArena = Number(process.argv[2] ?? 6000);
const a = (await import("../knight-knight-online.js?copy=a")).testHooks;
const b = (await import("../knight-knight-online.js?copy=b")).testHooks;

const ARENAS = ["MIXED", "MEADOW", "RIVER", "SNOW", "VOLCANO", "FOREST", "MINE", "LIGHTHOUSE", "BRIDGE", "LAVALAKE", "RING", "STORM", "SUMO", "SHIP", "SHOWDOWN", "JOUST"];

let failures = 0;
const started = Date.now();
for (const arena of ARENAS) {
    const seed = 1000 + ARENAS.indexOf(arena);
    const settings = {...SETTINGS, arena};
    a.startOnlineMatch(seed, settings, 0);
    b.startOnlineMatch(seed, settings, 1);
    const bots = [makeBot(0, seed), makeBot(1, seed + 7)];
    let rollbackChecks = 0;
    let rounds = 0;
    let lastRound = a.roundNumber;
    let failedAt = null;
    for (let tick = 0; tick < ticksPerArena && failedAt === null; tick++) {
        const bits = bots.map(bot => bot(a));

        // Every so often: save, play ahead, go back, play the same again, and compare
        if (tick % 97 === 0) {
            const saved = a.cloneState(a.captureState());
            const ahead = [];
            for (let i = 0; i < 30; i++) {
                ahead.push(bots.map(bot => bot(a)));
            }
            const first = [];
            for (const step of ahead) {
                a.stepOnline(step);
                first.push(a.hashState(a.captureState(), a.skipInHash));
            }
            a.restoreState(a.cloneState(saved));
            a.fx.on = false;
            for (let i = 0; i < ahead.length; i++) {
                a.stepOnline(ahead[i]);
                const again = a.hashState(a.captureState(), a.skipInHash);
                if (again !== first[i]) {
                    console.log(`  ${arena}: replaying from a saved copy came out different, ${i + 1} ticks after tick ${tick}`);
                    failedAt = tick;
                    break;
                }
            }
            a.fx.on = true;
            // Keep b in step with the ticks a just played
            for (const step of ahead) {
                b.stepOnline(step);
            }
            rollbackChecks++;
        }

        a.stepOnline(bits);
        b.stepOnline(bits);
        if (tick % 100 === 0) {
            const hashA = a.hashState(a.captureState(), a.skipInHash);
            const hashB = b.hashState(b.captureState(), b.skipInHash);
            if (hashA !== hashB) {
                console.log(`  ${arena}: the two games drifted apart by tick ${tick} (round ${a.roundNumber}, ${a.arenaName})`);
                failedAt = tick;
            }
        }
        if (a.roundNumber !== lastRound) {
            rounds++;
            lastRound = a.roundNumber;
        }
    }
    if (failedAt !== null) {
        failures++;
    }
    console.log(`${failedAt === null ? "ok  " : "FAIL"} ${arena.padEnd(10)} rounds played ${rounds}, score ${JSON.stringify(a.scores)}, rollback checks ${rollbackChecks}, now on ${a.arenaName}`);
}
console.log(failures === 0 ? `PASS (${Date.now() - started} ms)` : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
