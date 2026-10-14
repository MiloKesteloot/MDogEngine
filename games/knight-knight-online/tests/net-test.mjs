// Plays online matches between two copies of the game over a pretend network, with the real rollback netcode
// (Rollback.js), and checks they never drift apart. Each copy's player only sees its own game, like for real.
//
// node net-test.mjs [seconds of play] — tries a few kinds of network: good, laggy, jittery, and dropping packets

import "./fake-browser.mjs";
import {makeBot, SETTINGS} from "./bots.mjs";
import RollbackSession from "../Rollback.js";
import {pickDelay} from "../Online.js";
import {makeRandomState, nextRandom} from "../DetMath.js";
import {serializeState, deserializeState} from "../Snapshot.js";

const seconds = Number(process.argv[2] ?? 120);
const copies = [
    (await import("../knight-knight-online.js?copy=a")).testHooks,
    (await import("../knight-knight-online.js?copy=b")).testHooks,
];

const NETWORKS = [
    {name: "same city", latency: 12, jitter: 4, loss: 0, drift: 1.0},
    {name: "changing delay", latency: 25, jitter: 15, loss: 0.03, drift: 1.001, changeDelay: true},
    {name: "across the country", latency: 45, jitter: 10, loss: 0.01, drift: 1.002},
    {name: "bad wifi", latency: 70, jitter: 40, loss: 0.08, drift: 0.997},
    {name: "terrible", latency: 140, jitter: 60, loss: 0.15, drift: 1.004},
    // The guest's game is knocked out of step on purpose, and has to be put right by the host
    {name: "forced drift", latency: 30, jitter: 10, loss: 0.02, drift: 1.0, breakAt: [20000, 50000]},
];

function gameFor(hooks) {
    return {
        save: () => hooks.cloneState(hooks.captureState()),
        load: copy => hooks.restoreState(hooks.cloneState(copy)),
        step: bits => hooks.stepOnline(bits),
        hash: () => hooks.hashState(hooks.captureState(), hooks.skipInHash),
        setFx: on => { hooks.fx.on = on; },
        serialize: copy => JSON.parse(JSON.stringify(serializeState(copy, hooks.CLASSES, hooks.frozenThings.names))),
        deserialize: data => deserializeState(data, hooks.CLASSES, hooks.frozenThings.byName),
    };
}

let failed = false;
for (const network of NETWORKS) {
    const random = makeRandomState(99);
    const clocks = [0, 0]; // each player's own clock, in ms
    const inFlight = []; // {to, at, message}
    const rtt = network.latency * 2;
    const deliver = (from, message, lossy) => {
        if (lossy && nextRandom(random) < network.loss) {
            return;
        }
        const at = clocks[from] + network.latency + nextRandom(random) * network.jitter;
        inFlight.push({to: 1 - from, at, message: JSON.parse(JSON.stringify(message))});
    };
    const sessions = copies.map((hooks, i) => new RollbackSession({
        game: gameFor(hooks),
        localIndex: i,
        delay: pickDelay(rtt),
        now: () => clocks[i],
        send: message => deliver(i, message, true),
        sendReliable: message => deliver(i, message, false),
    }));
    sessions.forEach(session => { session.rtt = rtt; });
    copies.forEach((hooks, i) => hooks.startOnlineMatch(4242, {...SETTINGS, roundsToWin: 5}, i));
    const bots = [makeBot(0, 11), makeBot(1, 12)];

    // Each player's computer ticks at 160 a second by its own clock (one runs a little fast), and does what the game
    // does every tick: keeps in step with the other, and plays a tick
    const counters = [0, 0];
    const totalMs = seconds * 1000;
    let worldMs = 0;
    const tickMs = 1000 / 160;
    const nextTickAt = [0, 0];
    let maxStall = [0, 0];
    while (worldMs < totalMs) {
        worldMs += 1;
        // The input delay changing mid-match (it follows the ping)
        if (network.changeDelay && worldMs % 3000 === 0) {
            const i = (worldMs / 3000) % 2;
            sessions[i].setDelay(2 + Math.floor(nextRandom(random) * 7), () => bots[i](copies[i]));
        }
        if (network.breakAt?.includes(worldMs)) {
            copies[1].knights[1].x += 2.5;
        }
        // Messages arriving
        for (let m = inFlight.length - 1; m >= 0; m--) {
            const flight = inFlight[m];
            if (flight.at <= worldMs) {
                inFlight.splice(m, 1);
                copies[flight.to].fx.on = true;
                sessions[flight.to].receive(flight.message);
            }
        }
        for (let i = 0; i < 2; i++) {
            const speed = i === 0 ? network.drift : 1;
            clocks[i] = worldMs * speed;
            while (clocks[i] >= nextTickAt[i]) {
                nextTickAt[i] += tickMs;
                const session = sessions[i];
                const read = () => bots[i](copies[i]);
                // The same keeping-in-step as onlineTick in the game
                const syncError = session.getSyncError();
                if (syncError > 1 && counters[i]++ % 4 === 0) {
                    // wait a tick
                } else {
                    session.advance(read);
                    if (syncError < -1 && counters[i]++ % 4 === 0) {
                        session.advance(read);
                    }
                }
                maxStall[i] = Math.max(maxStall[i], session.stallTicks);
            }
        }
        // Messages are delivered in time order
        inFlight.sort((x, y) => y.at - x.at);
    }

    // Let everything that's in flight arrive, then play both to the same settled tick and compare
    for (const flight of inFlight) {
        sessions[flight.to].receive(flight.message);
    }
    const desync = sessions.map(session => session.desyncTick);
    const [s0, s1] = sessions;
    const report = `${network.name.padEnd(20)} ticks ${s0.tick}/${s1.tick}, rollbacks ${s0.rollbacks}/${s1.rollbacks} `
        + `(avg ${(s0.rolledBackTicks / Math.max(1, s0.rollbacks)).toFixed(1)} ticks), longest wait ${maxStall[0]}/${maxStall[1]} ticks, `
        + `delay ${s0.delay}, round ${copies[0].roundNumber}, score ${JSON.stringify(copies[0].scores)}, hashes compared up to ${s0.nextHashTick}`;
    const fixes = `, fixed ${s0.resyncs}/${s1.resyncs} drifts`;
    if (desync.some(t => t !== null) || s0.nextHashTick < 1000 || (network.breakAt !== undefined && s1.resyncs < network.breakAt.filter(at => at < totalMs - 3000).length)) {
        failed = true;
        console.log("FAIL " + report + fixes + " desync at " + desync);
    } else {
        console.log("ok   " + report + fixes);
    }
}
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
