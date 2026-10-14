// Pretend players for the tests: they walk at each other, circle, back off, swing a lot, taunt now and then, and
// press R for a rematch when a match ends. They use their own seeded random numbers, so a test plays out the same
// every time.

import {makeRandomState, nextRandom} from "../DetMath.js";

export const SETTINGS = {
    roundsToWin: 3, arena: "MIXED", boulders: "LOTS", weather: true, hazards: true, shiftingGround: true,
    juggernaut: true, killCam: "COOL KILLS", music: false, powerups: {},
};

const NORTH = 1, SOUTH = 2, WEST = 4, EAST = 8, SWING = 16, TAUNT = 32, REMATCH = 64;

export function makeBot(index, seed) {
    const random = makeRandomState(seed * 31 + index);
    let held = 0;
    let holdFor = 0;
    return game => {
        const me = game.knights[index];
        const other = game.knights[1 - index];
        let bits = 0;
        if (holdFor-- <= 0) {
            holdFor = 10 + Math.floor(nextRandom(random) * 60);
            held = 0;
            if (me !== undefined && other !== undefined) {
                const dx = other.getGroundX() - me.getGroundX();
                const dy = other.getGroundY() - me.getGroundY();
                const roll = nextRandom(random);
                const toward = roll < 0.6 ? 1 : roll < 0.8 ? -1 : 0;
                if (toward === 0) {
                    held = [NORTH, SOUTH, WEST, EAST, NORTH | EAST, SOUTH | WEST][Math.floor(nextRandom(random) * 6)];
                } else {
                    if (Math.abs(dx) > 4) held |= (dx * toward > 0) ? EAST : WEST;
                    if (Math.abs(dy) > 4) held |= (dy * toward > 0) ? SOUTH : NORTH;
                }
            }
        }
        bits |= held;
        if (nextRandom(random) < 0.025) bits |= SWING;
        if (nextRandom(random) < 0.0008) bits |= TAUNT;
        if (game.phase === "matchOver" && nextRandom(random) < 0.01) bits |= REMATCH;
        return bits;
    };
}
