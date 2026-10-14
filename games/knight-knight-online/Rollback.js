// Rollback netcode: how an online match stays in step on both computers, and still feels instant.
//
// Both computers run the whole game, and all they send each other is each tick's key presses (a few bits). Your own
// presses are used a few ticks later than you press them (the input delay), which gives them time to reach the other
// player. If the other player's presses for a tick haven't arrived yet when it's time to play it, the game guesses
// they're still holding what they were holding, and carries on. When their real presses arrive and the guess was
// wrong, it goes back to a saved copy of the game from before that tick, and plays it forward again with the right
// presses, quietly (no repeated sounds), all in the same frame. Usually the guess is right, and nothing needs redoing.
//
// Every so often both games fingerprint the same tick and compare, so if they ever drift apart it's noticed.
//
// Nothing here knows about the game itself. It's given:
//   game.save()          a copy of the game as it is now
//   game.load(copy)      put the game back how it was (the copy can be loaded again later)
//   game.step(bits)      play one tick, with each player's input bits (bits[0] is red, bits[1] blue)
//   game.hash()          a fingerprint of the game as it is now
//   game.setFx(on)       sounds and particles on or off (off while replaying ticks)
//   game.serialize(copy) / game.deserialize(data)   a copy of the game as JSON and back, for sending
// and send(message) for sending to the other player (it's fine if those get lost), sendReliable(message) for ones
// that have to arrive, and now(), the time in milliseconds.
//
// If the fingerprints ever don't match, the games have drifted apart (which shouldn't happen, but if it ever does
// it'd ruin the match). Then the host sends the guest its copy of the game from a tick both have settled, and the
// guest carries on from that. Each time it does, the "generation" goes up, so fingerprints from before don't count.

export const HELD_BITS = 15; // directions are held, so a guess repeats them; presses aren't, so a guess leaves them out
const SNAPSHOT_EVERY = 4; // ticks between saved copies (going back up to 3 ticks further than needed costs little)
const HASH_EVERY = 160; // ticks between fingerprints
const MAX_AHEAD = 48; // ticks it'll guess ahead before waiting for the other player (0.3 seconds)
const MAX_INPUTS_PER_MESSAGE = 120;
const SEND_EVERY = 3; // ticks between sends when nothing's changed (about 53 a second)
const TICK_MS = 1000 / 160;

export default class RollbackSession {
    constructor({game, localIndex, delay, send, sendReliable, now}) {
        this.game = game;
        this.localIndex = localIndex;
        this.delay = delay;
        this.send = send;
        this.sendReliable = sendReliable ?? send;
        this.now = now;
        this.generation = 0; // goes up each time the host sends its game to fix a drift
        this.resyncs = 0;
        this.lastResyncAt = -Infinity;

        this.tick = 0; // the next tick to play
        this.localInputs = []; // by tick
        this.remoteInputs = []; // by tick, as they arrive
        this.usedRemote = []; // what was used for the other player when each tick was played (maybe a guess)
        this.remoteKnown = 0; // the other player's inputs are known for every tick before this
        this.remoteAck = 0; // the other player has all of ours before this
        this.rollbackFrom = null; // the earliest tick that was played with a wrong guess
        this.snapshots = new Map(); // tick: a copy of the game just before that tick
        this.hashes = new Map(); // tick: fingerprint just before that tick
        this.nextHashTick = 0; // the next fingerprint to send, once its tick is settled
        this.remoteHashes = new Map();
        this.desyncTick = null;
        this.sinceSend = 0;
        this.lastSentBits = -1;

        this.remoteTick = 0; // the other player's tick, the last time they sent
        this.remoteTickAt = now();
        this.lastHeard = now();
        this.rtt = 0;
        this.advantage = 0; // how far ahead this game seems to be, smoothed out
        this.remoteAdvantage = 0; // how far ahead the other game says it seems to be
        this.stallTicks = 0; // how long it's been waiting for the other player
        this.rollbacks = 0; // for testing: how many times it's gone back
        this.rolledBackTicks = 0;

        // Nobody's pressing anything for the first few ticks, before the first presses can arrive
        for (let t = 0; t < delay; t++) {
            this.localInputs[t] = 0;
        }
    }

    // A message from the other player
    receive(message) {
        this.lastHeard = this.now();
        if (message.t === "in") {
            this.receiveInputs(message);
        } else if (message.t === "h") {
            if ((message.g ?? 0) === this.generation) {
                this.remoteHashes.set(message.k, message.h);
                this.checkHashes();
            }
        } else if (message.t === "state" && this.localIndex !== 0 && message.g > this.generation) {
            this.applyResync(message);
        }
    }

    receiveInputs(message) {
        for (let i = 0; i < message.b.length; i++) {
            const t = message.f + i;
            if (this.remoteInputs[t] !== undefined) {
                continue;
            }
            const bits = message.b[i];
            this.remoteInputs[t] = bits;
            // Already played with a guess, and the guess was wrong: it'll need playing again
            if (t < this.tick && this.usedRemote[t] !== bits) {
                this.rollbackFrom = this.rollbackFrom === null ? t : Math.min(this.rollbackFrom, t);
            }
        }
        while (this.remoteInputs[this.remoteKnown] !== undefined) {
            this.remoteKnown++;
        }
        this.remoteAck = Math.max(this.remoteAck, message.a);
        if (message.k > this.remoteTick) {
            this.remoteTick = message.k;
            this.remoteTickAt = this.now();
        }
        if (typeof message.v === "number") {
            this.remoteAdvantage = message.v;
        }
    }

    // The other player's input for a tick: the real one if it's here, or a guess
    remoteInputFor(t) {
        const bits = this.remoteInputs[t];
        if (bits !== undefined) {
            return bits;
        }
        return this.remoteKnown > 0 ? this.remoteInputs[this.remoteKnown - 1] & HELD_BITS : 0;
    }

    playTick(t) {
        if (t % SNAPSHOT_EVERY === 0) {
            this.snapshots.set(t, this.game.save());
        }
        if (t % HASH_EVERY === 0) {
            this.hashes.set(t, this.game.hash());
        }
        const remote = this.remoteInputFor(t);
        this.usedRemote[t] = remote;
        const bits = this.localIndex === 0 ? [this.localInputs[t], remote] : [remote, this.localInputs[t]];
        this.game.step(bits);
    }

    // Goes back to before the first wrong guess, and plays forward again to where it was
    rollback() {
        const from = this.rollbackFrom;
        this.rollbackFrom = null;
        let start = -1;
        for (const t of this.snapshots.keys()) {
            if (t <= from && t > start) {
                start = t;
            }
        }
        if (start < 0) {
            throw new Error("No saved game to go back to from tick " + from);
        }
        this.rollbacks++;
        this.rolledBackTicks += this.tick - start;
        this.game.load(this.snapshots.get(start));
        this.game.setFx(false);
        try {
            for (let t = start; t < this.tick; t++) {
                if (t !== start && t % SNAPSHOT_EVERY === 0) {
                    this.snapshots.set(t, this.game.save());
                }
                if (t !== start && t % HASH_EVERY === 0) {
                    this.hashes.set(t, this.game.hash());
                }
                const remote = this.remoteInputFor(t);
                this.usedRemote[t] = remote;
                const bits = this.localIndex === 0 ? [this.localInputs[t], remote] : [remote, this.localInputs[t]];
                this.game.step(bits);
            }
        } finally {
            this.game.setFx(true);
        }
    }

    // How many ticks ahead of the other player this game is (negative when behind), going by when they last sent and
    // how long messages take
    getAdvantage() {
        const remoteNow = this.remoteTick + ((this.now() - this.remoteTickAt) + this.rtt / 2) / TICK_MS;
        return this.tick - remoteNow;
    }

    // Changes the input delay, mid-match (as the ping changes). Shorter is easy: presses already read for later ticks
    // are used a bit sooner. Longer leaves ticks nobody's read presses for yet, so they get what's held right now.
    setDelay(delay, readInput) {
        if (delay > this.delay) {
            const held = readInput !== undefined ? readInput() & HELD_BITS : 0;
            for (let t = this.tick + this.delay; t < this.tick + delay; t++) {
                if (this.localInputs[t] === undefined) {
                    this.localInputs[t] = held;
                }
            }
        }
        this.delay = delay;
    }

    // How far this game should catch up (negative) or slow down (positive), in ticks. Both games measure how far ahead
    // they seem to be and tell each other, and it's half the difference: a mistake both make the same way (like
    // guessing the ping a bit wrong) cancels out, instead of both slowing down, or both speeding up.
    getSyncError() {
        return (this.advantage - this.remoteAdvantage) / 2;
    }

    isWaiting() {
        return this.tick - this.remoteKnown >= MAX_AHEAD;
    }

    // Plays one more tick if it can. readInput() gives this player's input bits right now. Returns whether it played
    // a tick (it doesn't when it's too far ahead of the other player, and has to wait for them).
    advance(readInput) {
        if (this.rollbackFrom !== null) {
            this.rollback();
        }
        this.advantage += (this.getAdvantage() - this.advantage) * 0.02;
        if (this.isWaiting()) {
            this.stallTicks++;
            this.sendInputs(true);
            return false;
        }
        this.stallTicks = 0;

        const sampleTick = this.tick + this.delay;
        if (this.localInputs[sampleTick] === undefined) {
            this.localInputs[sampleTick] = readInput();
        }
        this.playTick(this.tick);
        this.tick++;

        const changed = this.localInputs[sampleTick] !== this.lastSentBits;
        this.lastSentBits = this.localInputs[sampleTick];
        this.sendInputs(changed);
        this.tidy();
        return true;
    }

    sendInputs(now) {
        this.sinceSend++;
        if (!now && this.sinceSend < SEND_EVERY) {
            return;
        }
        this.sinceSend = 0;
        const first = this.remoteAck;
        const last = Math.min(this.localInputs.length, first + MAX_INPUTS_PER_MESSAGE);
        this.send({t: "in", f: first, b: this.localInputs.slice(first, last), a: this.remoteKnown, k: this.tick,
            v: Math.round(this.advantage * 10) / 10});
    }

    // Forgets what can't be needed any more, and sends fingerprints for ticks that are settled
    tidy() {
        // The newest saved copy from a tick that's settled (both players' inputs known), and everything after it, are
        // kept: a wrong guess can only be at or after the first tick that isn't settled
        let keepFrom = -1;
        for (const t of this.snapshots.keys()) {
            if (t <= this.remoteKnown && t > keepFrom) {
                keepFrom = t;
            }
        }
        for (const t of [...this.snapshots.keys()]) {
            if (t < keepFrom) {
                this.snapshots.delete(t);
            }
        }
        // A fingerprint just before tick t is settled once every input before t is known
        while (this.nextHashTick <= this.remoteKnown && this.nextHashTick < this.tick) {
            const t = this.nextHashTick;
            if (this.hashes.has(t)) {
                this.send({t: "h", k: t, h: this.hashes.get(t), g: this.generation});
            }
            this.nextHashTick += HASH_EVERY;
        }
        // A fix that had to wait (they're at most one a second)
        if (this.localIndex === 0 && this.desyncTick !== null) {
            this.sendResync();
        }
        this.checkHashes();
    }

    // The host's side of fixing a drift: its copy of the game from a tick the guest has played
    sendResync() {
        const time = this.now();
        if (time - this.lastResyncAt < 1000) {
            return;
        }
        const latest = Math.min(this.remoteKnown, this.remoteTick);
        let tick = -1;
        for (const t of this.snapshots.keys()) {
            if (t <= latest && t > tick) {
                tick = t;
            }
        }
        if (tick < 0) {
            tick = Math.min(...this.snapshots.keys());
        }
        if (!Number.isFinite(tick)) {
            return;
        }
        this.lastResyncAt = time;
        this.generation++;
        this.resyncs++;
        this.desyncTick = null;
        this.remoteHashes.clear();
        this.sendReliable({t: "state", k: tick, g: this.generation, s: this.game.serialize(this.snapshots.get(tick))});
    }

    // The guest's side: carry on from the host's copy
    applyResync(message) {
        const start = message.k;
        const state = this.game.deserialize(message.s);
        this.generation = message.g;
        this.resyncs++;
        const end = Math.max(this.tick, start);
        // If the host's copy is from a tick this game hasn't got to yet, it jumps ahead, and anything it hadn't
        // pressed yet for the ticks it skipped is nothing
        for (let t = start; t < end + this.delay; t++) {
            if (this.localInputs[t] === undefined) {
                this.localInputs[t] = 0;
            }
        }
        this.snapshots.clear();
        this.hashes.clear();
        this.remoteHashes.clear();
        this.snapshots.set(start, state);
        this.game.load(state);
        this.game.setFx(false);
        try {
            for (let t = start; t < end; t++) {
                if (t !== start && t % SNAPSHOT_EVERY === 0) {
                    this.snapshots.set(t, this.game.save());
                }
                if (t % HASH_EVERY === 0) {
                    this.hashes.set(t, this.game.hash());
                }
                const remote = this.remoteInputFor(t);
                this.usedRemote[t] = remote;
                const bits = this.localIndex === 0 ? [this.localInputs[t], remote] : [remote, this.localInputs[t]];
                this.game.step(bits);
            }
        } finally {
            this.game.setFx(true);
        }
        this.tick = end;
        this.rollbackFrom = null;
        this.desyncTick = null;
        this.nextHashTick = Math.max(this.nextHashTick, Math.ceil(start / HASH_EVERY) * HASH_EVERY);
    }

    checkHashes() {
        for (const [t, hash] of this.remoteHashes) {
            if (t >= this.nextHashTick) {
                continue;
            }
            const mine = this.hashes.get(t);
            if (mine !== undefined && mine !== hash && this.desyncTick === null) {
                console.warn("Knight Knight Online: the games drifted apart at tick " + t, mine, hash);
                this.desyncTick = t;
                if (this.localIndex === 0) {
                    this.sendResync();
                }
            }
            this.remoteHashes.delete(t);
            this.hashes.delete(t);
        }
        // Old fingerprints nobody will ask about
        for (const t of [...this.hashes.keys()]) {
            if (t < this.nextHashTick - HASH_EVERY * 8) {
                this.hashes.delete(t);
            }
        }
    }
}
