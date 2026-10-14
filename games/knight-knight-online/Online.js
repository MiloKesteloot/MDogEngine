// Hosting and joining online matches: making a join code, waiting for a friend, starting the match together, and
// keeping it going (with the rollback netcode in Rollback.js) until someone leaves.
//
// The host is red and the guest is blue. The host's settings are the match's settings, and the guest's shown them as
// soon as they're connected. Before the match starts the two measure how long messages take to get between them, and
// each picks its input delay from that. After a match the host can take them both back to the lobby, to change the
// settings without anyone leaving, and start a new match from there.
//
// A quick match is with whoever else is looking for one: the matchmaker on the server pairs them up and gives them a
// code, and from there it's like any other match (with the standard settings).

import Connection from "./Connection.js";
import RollbackSession from "./Rollback.js";
import {getServerUrl} from "./config.js";

// Codes leave out letters that are easy to mix up (O and 0, I, 1 and L, C and G, U and V) and X. Capitals don't
// matter: a typed or pasted code is made all capitals.
const CODE_LETTERS = "ABDEFHJKMNPQRSTWYZ23456789";
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
        this.state = "idle"; // idle, connecting, searching (quick match), waiting, syncing, playing, lobby, ended
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
        this.hostSettings = null; // the match's settings (the guest gets them from the host)
        this.tries = 0;
        this.lastDelayCheck = 0;
        this.readHeld = undefined; // the keys being held right now (set by the game)
        this.onPeerJoined = null; // called when a friend joins the host's code (set by the game)
        this.wasDirect = false;
        this.quickMatch = false; // this match came from the matchmaker
        this.quickSocket = null; // the connection to the matchmaker, while looking
        this.quickStats = null; // {matches, waiting}, from the matchmaker
        this.searchStarted = 0;
    }

    isActive() {
        return this.state !== "idle";
    }

    isPlaying() {
        return this.state === "playing";
    }

    isConnected() {
        return this.state === "syncing" || this.state === "playing" || this.state === "lobby";
    }

    getLocalIndex() {
        return this.role === "host" ? 0 : 1;
    }

    host(settingsValues) {
        this.quickMatch = false;
        this.hostSettings = settingsValues;
        this.tries = 0;
        this.connect("host", makeCode());
    }

    join(code) {
        this.quickMatch = false;
        this.tries = 0;
        this.connect("guest", code);
    }

    // Looking for anyone else who's looking. settingsValues are used if this one ends up hosting.
    quick(settingsValues) {
        this.close();
        const server = getServerUrl();
        this.quickMatch = true;
        this.role = null;
        this.code = null;
        this.hostSettings = settingsValues;
        this.quickStats = null;
        this.message = null;
        if (server === null) {
            this.end("ONLINE ISN'T SET UP YET");
            return;
        }
        this.state = "connecting";
        this.searchStarted = now();
        let socket;
        try {
            socket = new WebSocket(server.replace(/\/$/, "") + "/quick");
        } catch (e) {
            this.end("COULDN'T REACH THE SERVER");
            return;
        }
        this.quickSocket = socket;
        socket.addEventListener("message", event => {
            let message;
            try {
                message = JSON.parse(event.data);
            } catch (e) {
                return;
            }
            if (this.quickSocket !== socket) {
                return;
            }
            if (message.e === "queued" || message.e === "stats") {
                this.quickStats = {matches: message.matches, waiting: message.waiting};
                if (message.e === "queued") {
                    this.state = "searching";
                    this.searchStarted = now();
                }
            } else if (message.e === "match") {
                // Found someone: on to the room the matchmaker made up for the two
                this.quickSocket = null;
                socket.close();
                this.tries = 0;
                this.connect(message.role, message.code);
            }
        });
        socket.addEventListener("close", () => {
            if (this.quickSocket === socket) {
                this.quickSocket = null;
                this.end(this.state === "connecting" ? "COULDN'T REACH THE SERVER" : "LOST THE CONNECTION");
            }
        });
    }

    // How long it's been looking for a quick match, in seconds
    getSearchSeconds() {
        return Math.floor((now() - this.searchStarted) / 1000);
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
        this.wasDirect = false;
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
            if (this.role === "host") {
                // The game settles the settings first (the host may have been changing them while waiting), then the
                // guest's sent them, so they can see what they're in for while it gets ready
                this.onPeerJoined?.();
                this.connection.sendReliable({t: "settings", values: this.hostSettings});
            } else {
                this.hostSettings = null;
            }
        } else if (message.e === "peer-left") {
            if (this.state === "playing" || this.state === "lobby") {
                this.end("YOUR OPPONENT LEFT");
            } else if (this.role === "host") {
                // They left before it started: wait for someone else
                this.state = "waiting";
            } else {
                this.end(this.quickMatch ? "YOUR OPPONENT LEFT" : "THE HOST LEFT");
            }
        } else if (message.e === "no-room" && this.quickMatch && this.role === "guest" && this.tries < 20) {
            // Got here before the other one finished making the room: try again in a moment
            this.tries++;
            this.connection.close();
            this.connection = null;
            const code = this.code;
            setTimeout(() => {
                if (this.state === "connecting" && this.code === code && this.connection === null) {
                    this.connect("guest", code);
                }
            }, 300);
        } else if (message.e === "taken" && this.role === "host" && this.tries < 5 && !this.quickMatch) {
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
        } else if (message.t === "start" && this.role === "guest" && (this.state === "syncing" || this.state === "lobby")) {
            this.hostSettings = message.settings;
            this.begin(message.seed, message.settings);
            this.connection.sendReliable({t: "go"});
        } else if (message.t === "go" && this.role === "host" && this.state === "syncing") {
            this.begin(this.pendingSeed, this.hostSettings);
        } else if (message.t === "settings" && this.role === "guest") {
            this.hostSettings = message.values;
        } else if (message.t === "lobby" && this.role === "guest") {
            this.session = null;
            this.state = "lobby";
        } else if (message.t === "bye") {
            this.end(this.state === "playing" || this.state === "lobby" || this.quickMatch ? "YOUR OPPONENT LEFT" : "THE HOST LEFT");
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

    // The host, after a match: both go back to the lobby, staying connected, while the host changes the settings
    toLobby() {
        if (this.role !== "host" || this.state !== "playing") {
            return;
        }
        this.connection.sendReliable({t: "lobby"});
        this.session = null;
        this.pendingSeed = undefined;
        this.state = "lobby";
    }

    // The host, in the lobby: the settings changed, so the guest sees them
    changeSettings(values) {
        this.hostSettings = values;
        this.connection?.sendReliable({t: "settings", values});
    }

    // The host, in the lobby: a new match, with the settings as they are now
    startFromLobby(values) {
        if (this.role !== "host" || this.state !== "lobby") {
            return;
        }
        this.hostSettings = values;
        this.pendingSeed = Math.floor(Math.random() * 4294967296);
        this.state = "syncing";
        this.connection.sendReliable({t: "start", seed: this.pendingSeed, settings: values});
    }

    // Every tick, playing or not
    update() {
        if (this.connection === null || !this.isConnected()) {
            return;
        }
        const time = now();
        // Pings from before the direct connection opened went the slow way round, through the server
        const direct = this.connection.direct;
        if (direct !== this.wasDirect) {
            this.wasDirect = direct;
            this.rttSamples = [];
            this.rtt = null;
        }
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
        if (this.quickSocket !== null) {
            const socket = this.quickSocket;
            this.quickSocket = null;
            socket.close();
        }
        if (this.connection !== null) {
            this.connection.close();
            this.connection = null;
        }
        this.session = null;
        this.pendingSeed = undefined;
    }
}

// How many matches are being played, and if someone's waiting for a quick match: {matches, waiting}, or null
export async function fetchStats() {
    const server = getServerUrl();
    if (server === null) {
        return null;
    }
    try {
        const response = await fetch(server.replace(/^ws/, "http").replace(/\/$/, "") + "/stats");
        return await response.json();
    } catch (e) {
        return null;
    }
}
