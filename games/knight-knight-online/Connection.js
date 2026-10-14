// The connection between the two players' browsers.
//
// Both first connect to the room for their join code on the server (see server/worker.js), over a WebSocket. The
// server passes messages between them, and that's enough to play. But the server's in the way, so they also use it to
// set up a direct connection (WebRTC), which is faster: the host offers, the guest answers, and they swap addresses.
// Once that's open, game messages go straight between the two browsers, and if it can't be opened (some networks
// don't allow it) everything keeps going through the server.
//
// Messages that have to arrive (starting the match, leaving) always go through the server. Key presses go whichever
// way is fastest, and the direct way is allowed to drop them (each one's sent again until it's known to have arrived,
// see Rollback.js), so a lost one never holds up the ones after it.

const ICE_SERVERS = [{urls: "stun:stun.cloudflare.com:3478"}, {urls: "stun:stun.l.google.com:19302"}];

export default class Connection {
    // handlers: onServer(message) for the server's own messages, onMessage(message) for the other player's, and
    // onClose() when the server connection goes
    constructor(serverUrl, code, role, handlers) {
        this.role = role;
        this.handlers = handlers;
        this.closed = false;
        this.pc = null;
        this.channel = null;
        this.pendingCandidates = [];
        this.direct = false; // the direct connection's open

        this.ws = new WebSocket(serverUrl.replace(/\/$/, "") + "/room/" + code + "?role=" + role);
        this.ws.addEventListener("message", event => this.onSocketMessage(event.data));
        this.ws.addEventListener("close", () => {
            if (!this.closed) {
                this.closed = true;
                this.closeDirect();
                this.handlers.onClose();
            }
        });
        this.ws.addEventListener("error", () => {
            // A close always comes after, and handles it
        });
    }

    onSocketMessage(data) {
        let message;
        try {
            message = JSON.parse(data);
        } catch (e) {
            return;
        }
        if (message.t === "server") {
            if (message.e === "peer-joined" && this.role === "host") {
                this.startDirect();
            }
            if (message.e === "peer-left") {
                this.closeDirect();
            }
            this.handlers.onServer(message);
            return;
        }
        if (message.t === "rtc") {
            this.onSignal(message);
            return;
        }
        this.handlers.onMessage(message);
    }

    // ---------- The direct connection ----------

    makePeer() {
        if (typeof RTCPeerConnection === "undefined") {
            return false;
        }
        this.pc = new RTCPeerConnection({iceServers: ICE_SERVERS});
        this.pc.addEventListener("icecandidate", event => {
            if (event.candidate !== null) {
                this.sendSocket({t: "rtc", candidate: event.candidate.toJSON()});
            }
        });
        this.pc.addEventListener("connectionstatechange", () => {
            if (this.pc !== null && (this.pc.connectionState === "failed" || this.pc.connectionState === "closed")) {
                this.direct = false;
            }
        });
        return true;
    }

    // The host starts it, once the guest's in the room
    async startDirect() {
        this.closeDirect();
        try {
            if (!this.makePeer()) {
                return;
            }
            // Unordered and never resent: a late key press is no use, and a newer message has it anyway
            this.useChannel(this.pc.createDataChannel("game", {ordered: false, maxRetransmits: 0}));
            await this.pc.setLocalDescription(await this.pc.createOffer());
            this.sendSocket({t: "rtc", description: this.pc.localDescription.toJSON()});
        } catch (e) {
            console.warn("Couldn't start a direct connection, playing through the server", e);
        }
    }

    async onSignal(message) {
        try {
            if (message.description !== undefined) {
                if (message.description.type === "offer") {
                    this.closeDirect();
                    if (!this.makePeer()) {
                        return;
                    }
                    this.pc.addEventListener("datachannel", event => this.useChannel(event.channel));
                    await this.pc.setRemoteDescription(message.description);
                    await this.pc.setLocalDescription(await this.pc.createAnswer());
                    this.sendSocket({t: "rtc", description: this.pc.localDescription.toJSON()});
                } else if (this.pc !== null) {
                    await this.pc.setRemoteDescription(message.description);
                }
                for (const candidate of this.pendingCandidates) {
                    await this.pc.addIceCandidate(candidate);
                }
                this.pendingCandidates = [];
            } else if (message.candidate !== undefined) {
                if (this.pc === null || this.pc.remoteDescription === null) {
                    this.pendingCandidates.push(message.candidate);
                } else {
                    await this.pc.addIceCandidate(message.candidate);
                }
            }
        } catch (e) {
            console.warn("Direct connection trouble, playing through the server", e);
        }
    }

    useChannel(channel) {
        this.channel = channel;
        channel.addEventListener("open", () => {
            this.direct = true;
        });
        channel.addEventListener("close", () => {
            if (this.channel === channel) {
                this.direct = false;
            }
        });
        channel.addEventListener("message", event => {
            try {
                this.handlers.onMessage(JSON.parse(event.data));
            } catch (e) {
                // Not ours
            }
        });
    }

    closeDirect() {
        this.direct = false;
        if (this.channel !== null) {
            this.channel.close();
            this.channel = null;
        }
        if (this.pc !== null) {
            this.pc.close();
            this.pc = null;
        }
        this.pendingCandidates = [];
    }

    // ---------- Sending ----------

    sendSocket(message) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    // Has to arrive
    sendReliable(message) {
        this.sendSocket(message);
    }

    // Fastest way there, and it's fine if it's lost
    sendFast(message) {
        if (this.direct && this.channel !== null && this.channel.readyState === "open") {
            try {
                this.channel.send(JSON.stringify(message));
                return;
            } catch (e) {
                this.direct = false;
            }
        }
        this.sendSocket(message);
    }

    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.closeDirect();
        this.ws.close();
    }
}
