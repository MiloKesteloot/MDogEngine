// Hosting and joining online matches: making a join code, waiting for a friend, starting the match together, and
// keeping it going (with the rollback netcode in Rollback.js) until someone leaves.
//
// The host is red and the guest is blue. The host's settings are the match's settings. Before the match starts the
// two measure how long messages take to get between them, and each picks its input delay from that.

import Connection from "./Connection.js";
import RollbackSession from "./Rollback.js";
import {getServerUrl} from "./config.js";

// Codes leave out letters that are easy to mix up: O and 0, I, 1 and L, C and G, U and V. Capitals don't matter (a
// typed or pasted code is made all capitals).
const CODE_LETTERS = "ABDEFHJKMNPQRSTWXYZ23456789";
export const CODE_LENGTH = 4;
const PING_EVERY_MS = 250;
const SYNC_MS = 1200; // measuring the ping before the match starts
const TIMEOUT_MS = 8000; // nothing heard from the other player for this long: they're gone
const TICK_MS = 1000 / 160;
const DELAY_CHECK_MS = 1000; // how often the input delay can change, by a tick at a time

function now() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function isCodeLetter(letter) {
    return letter.length === 1 && CODE_LETTERS.includes(letter.toUpperCase());
}

export function makeCode() {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
    }
    return code;
}

export function cleanCode(text) {
    return text.toUpperCase().split("").filter(letter => CODE_LETTERS.includes(letter)).join("").slice(0, CODE_LENGTH);
}

// The input delay for a round trip time: about long enough for presses to arrive before they're needed, so the game
// rarely has to guess, but never so long it feels sluggish
export function pickDelay(rtt) {
    return Math.max(2, Math.min(8, Math.round(rtt / 2 / TICK_MS) + 1));
}

export default class Online {
    // game: the same as for RollbackSession (save, load, step, hash, setFx), plus start(seed, settings, localIndex)
    constructor(game) {
        this.game = game;
        this.state = "idle"; // idle, connecting, waiting, syncing, playing, ended
        this.role = null;
        this.code = null;
        this.message = null; // why it ended
        this.connection = null;
        this.session = null;
        this.rtt = null; // the round trip time, in ms: the middle of the last few pings
        this.rttSamples = [];
        this.pings = 0;
        this.lastPing = 0;
        this.syncStarted = 0;
        this.lastHeard = 0;
        this.hostSettings = null;
        this.tries = 0;
        this.lastDelayCheck = 0;
        this.readHeld = undefined; // the keys being held right now (set by the game)
    }

    isActive() {
        return this.state !== "idle";
    }

    isPlaying() {
        return this.state === "playing";
    }

    getLocalIndex() {
        return this.role === "host" ? 0 : 1;
    }

    host(settingsValues) {
        this.hostSettings = settingsValues;
        this.tries = 0;
        this.connect("host", makeCode());
    }

    join(code) {
        this.connect("guest", code);
    }

    connect(role, code) {
        this.close();
        const server = getServerUrl();
        this.role = role;
        this.code = code;
        if (server === null) {
            this.end("ONLINE ISN'T SET UP YET");
            return;
        }
        this.state = "connecting";
        this.message = null;
        this.rtt = null;
        this.rttSamples = [];
        this.pings = 0;
        try {
            this.connection = new Connection(server, code, role, {
                onServer: message => this.onServer(message),
                onMessage: message => this.onMessage(message),
                onClose: () => this.onClose(),
            });
        } catch (e) {
            this.end("COULDN'T REACH THE SERVER");
        }
    }

    onServer(message) {
        if (message.e === "hosting") {
            this.state = "waiting";
        } else if (message.e === "joined" || message.e === "peer-joined") {
            this.startSync();
        } else if (message.e === "peer-left") {
            if (this.state === "playing") {
                this.end("YOUR OPPONENT LEFT");
            } else if (this.role === "host") {
                // They left before it started: wait for someone else
                this.state = "waiting";
            } else {
                this.end("THE HOST LEFT");
            }
        } else if (message.e === "taken" && this.role === "host" && this.tries < 5) {
            // Someone's already using that code
            this.tries++;
            this.connect("host", makeCode());
        } else if (message.e === "no-room") {
            this.end("NO MATCH WITH THAT CODE");
        } else if (message.e === "full") {
            this.end("THAT MATCH IS FULL");
        } else if (message.e === "taken") {
            this.end("COULDN'T MAKE A CODE");
        }
    }

    startSync() {
        this.state = "syncing";
        this.syncStarted = now();
        this.lastHeard = now();
        this.lastPing = 0;
    }

    onMessage(message) {
        this.lastHeard = now();
        if (message.t === "ping") {
            this.connection.sendFast({t: "pong", at: message.at});
        } else if (message.t === "pong") {
            this.pings++;
            // The first one's often slow (the connection's still being set up), so it's left out
            if (this.pings > 1) {
                this.rttSamples.push(now() - message.at);
                if (this.rttSamples.length > 9) {
                    this.rttSamples.shift();
                }
                const sorted = [...this.rttSamples].sort((a, b) => a - b);
                this.rtt = sorted[Math.floor(sorted.length / 2)];
            }
            if (this.session !== null) {
                this.session.rtt = this.rtt;
            }
        } else if (message.t === "start" && this.role === "guest" && this.state === "syncing") {
            this.begin(message.seed, message.settings);
            this.connection.sendReliable({t: "go"});
        } else if (message.t === "go" && this.role === "host" && this.state === "syncing") {
            this.begin(this.pendingSeed, this.hostSettings);
        } else if (message.t === "bye") {
            this.end(this.state === "playing" ? "YOUR OPPONENT LEFT" : "THE HOST LEFT");
        } else if (this.session !== null) {
            this.session.receive(message);
        }
    }

    begin(seed, settings) {
        this.state = "playing";
        this.lastHeard = now();
        this.session = new RollbackSession({
            game: this.game,
            localIndex: this.getLocalIndex(),
            // The fastest ping is the truest: slower ones were held up along the way
            delay: pickDelay(this.rttSamples.length > 0 ? Math.min(...this.rttSamples) : 60),
            send: message => this.connection.sendFast(message),
            sendReliable: message => this.connection.sendReliable(message),
            now,
        });
        this.session.rtt = this.rtt ?? 60;
        this.game.start(seed, settings, this.getLocalIndex());
    }

    onClose() {
        this.connection = null;
        if (this.state === "connecting") {
            this.end("COULDN'T REACH THE SERVER");
        } else if (this.state !== "ended" && this.state !== "idle") {
            this.end("LOST THE CONNECTION");
        }
    }

    // Every tick, playing or not
    update() {
        if (this.connection === null || (this.state !== "syncing" && this.state !== "playing")) {
            return;
        }
        const time = now();
        if (time - this.lastPing > PING_EVERY_MS) {
            this.lastPing = time;
            this.connection.sendFast({t: "ping", at: time});
        }
        if (time - this.lastHeard > TIMEOUT_MS) {
            this.end("LOST THE CONNECTION");
            return;
        }
        // The input delay follows the ping, a tick at a time
        if (this.session !== null && time - this.lastDelayCheck > DELAY_CHECK_MS && this.rttSamples.length >= 3) {
            this.lastDelayCheck = time;
            const target = pickDelay(Math.min(...this.rttSamples));
            if (target !== this.session.delay) {
                this.session.setDelay(this.session.delay + Math.sign(target - this.session.delay), this.readHeld);
            }
        }
        // The host starts the match once it knows the ping
        if (this.state === "syncing" && this.role === "host" && this.pendingSeed === undefined
            && time - this.syncStarted > SYNC_MS && this.pings >= 3) {
            this.pendingSeed = Math.floor(Math.random() * 4294967296);
            this.connection.sendReliable({t: "start", seed: this.pendingSeed, settings: this.hostSettings});
        }
    }

    isUsingServer() {
        return this.connection !== null && !this.connection.direct;
    }

    end(message) {
        this.close();
        this.state = "ended";
        this.message = message;
    }

    // Leaving on purpose
    leave() {
        if (this.connection !== null) {
            this.connection.sendReliable({t: "bye"});
        }
        this.close();
        this.state = "idle";
        this.message = null;
    }

    close() {
        if (this.connection !== null) {
            this.connection.close();
            this.connection = null;
        }
        this.session = null;
        this.pendingSeed = undefined;
    }
}
