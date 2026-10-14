// The Knight Knight Online server, a Cloudflare Worker (see README.md for setting it up).
//
// It does join codes and quick matches. Each code is a room, run by a Durable Object (one little server per room, so
// both players reach the same one). The host connects with ?role=host and the guest with ?role=guest, over
// WebSockets, and the room passes every message from one to the other. The players use that to set up a direct
// connection between their browsers, and after that the room only carries the odd message, unless the direct
// connection can't be made, in which case the whole match goes through it.
//
// The room's own messages to the players are {t: "server", e: ...}:
//   hosting       you're the host, waiting for someone to join
//   joined        you've joined the host
//   peer-joined   (to the host) someone joined
//   peer-left     the other player's gone
//   taken         (to a host) that code's already being used, pick another
//   no-room       (to a guest) nobody's hosting that code
//   full          (to a guest) that match already has two players
//
// Quick matches go through the matchmaker (another Durable Object, just one of it), at /quick. Whoever comes along
// while someone's waiting is paired with them: the matchmaker makes up a code and tells the one who was waiting to
// host it and the newcomer to join it, and from there it's a normal room. Its messages:
//   queued        {matches, waiting}: nobody's waiting, so you are now (matches is how many are being played)
//   stats         {matches, waiting}: the numbers changed while you wait
//   match         {code, role}: found someone! Host or join this code.
// The rooms tell the matchmaker when a match starts and ends, so it knows how many are being played, and /stats
// tells anyone (like the title screen) how many are being played and if someone's waiting.

import {DurableObject} from "cloudflare:workers";

const CODE = /^\/room\/([A-Z0-9]{4,8})$/;
const MAX_MESSAGE = 1024 * 1024; // big enough for a whole copy of the game (see Rollback.js)
const QUICK_CODE_LETTERS = "ABDEFHJKMNPQRSTWYZ23456789";
const QUICK_CODE_LENGTH = 6; // longer than the codes people host, so they never clash
const MATCH_FORGET_MS = 3 * 60 * 60 * 1000; // a match nobody said had ended is forgotten after this long

const CORS = {"Access-Control-Allow-Origin": "*"};

function json(value) {
    return new Response(JSON.stringify(value), {headers: {"Content-Type": "application/json", ...CORS}});
}

function getMatchmaker(env) {
    return env.MATCHMAKER.get(env.MATCHMAKER.idFromName("matchmaker"));
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === "/quick" || url.pathname === "/stats") {
            if (url.pathname === "/quick" && request.headers.get("Upgrade") !== "websocket") {
                return new Response("Quick matches only speak WebSocket", {status: 426});
            }
            return getMatchmaker(env).fetch(request);
        }
        const match = url.pathname.match(CODE);
        if (match === null) {
            return new Response("Knight Knight Online server. Rooms are at /room/CODE.", {status: url.pathname === "/" ? 200 : 404});
        }
        if (request.headers.get("Upgrade") !== "websocket") {
            return new Response("Rooms only speak WebSocket", {status: 426});
        }
        const room = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
        return room.fetch(request);
    },
};

export class Room extends DurableObject {
    // The players' sockets that are still open (the room sleeps between messages, so it asks rather than remembering)
    getSocket(role) {
        return this.ctx.getWebSockets(role).find(socket => socket.readyState === WebSocket.OPEN) ?? null;
    }

    async fetch(request) {
        const url = new URL(request.url);
        const role = url.searchParams.get("role");
        const code = url.pathname.match(CODE)?.[1] ?? "";
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        let refusal = null;
        if (role !== "host" && role !== "guest") {
            refusal = "no-room";
        } else if (role === "host" && this.getSocket("host") !== null) {
            refusal = "taken";
        } else if (role === "guest" && this.getSocket("host") === null) {
            refusal = "no-room";
        } else if (role === "guest" && this.getSocket("guest") !== null) {
            refusal = "full";
        }
        if (refusal !== null) {
            server.accept();
            server.send(JSON.stringify({t: "server", e: refusal}));
            server.close(4000, refusal);
            return new Response(null, {status: 101, webSocket: client});
        }

        this.ctx.acceptWebSocket(server, [role]);
        server.serializeAttachment({role, code});
        if (role === "host") {
            server.send(JSON.stringify({t: "server", e: "hosting"}));
        } else {
            server.send(JSON.stringify({t: "server", e: "joined"}));
            this.getSocket("host")?.send(JSON.stringify({t: "server", e: "peer-joined"}));
            await this.report("start", code);
        }
        return new Response(null, {status: 101, webSocket: client});
    }

    webSocketMessage(socket, message) {
        if (typeof message !== "string" || message.length > MAX_MESSAGE) {
            return;
        }
        const {role} = socket.deserializeAttachment();
        this.getSocket(role === "host" ? "guest" : "host")?.send(message);
    }

    async webSocketClose(socket, code, reason) {
        await this.leave(socket);
        try {
            socket.close(code, reason);
        } catch (e) {
            // Already closed
        }
    }

    async webSocketError(socket) {
        await this.leave(socket);
    }

    async leave(socket) {
        const {role, code} = socket.deserializeAttachment() ?? {};
        const other = this.getSocket(role === "host" ? "guest" : "host");
        other?.send(JSON.stringify({t: "server", e: "peer-left"}));
        // Without its host the room's over, so the guest goes too
        if (role === "host" && other !== null) {
            other.close(4001, "host left");
        }
        await this.report("end", code);
    }

    // Tells the matchmaker a match started or ended, for counting how many are being played
    async report(event, code) {
        if (!code) {
            return;
        }
        try {
            await getMatchmaker(this.env).fetch(`https://matchmaker/match?e=${event}&code=${code}`);
        } catch (e) {
            // Only the count's wrong
        }
    }
}

export class Matchmaker extends DurableObject {
    getWaiting() {
        return this.ctx.getWebSockets("waiting").filter(socket => socket.readyState === WebSocket.OPEN);
    }

    async getStats() {
        const matches = (await this.ctx.storage.get("matches")) ?? {};
        const now = Date.now();
        return {
            matches: Object.values(matches).filter(started => now - started < MATCH_FORGET_MS).length,
            waiting: this.getWaiting().length,
        };
    }

    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/stats") {
            return json(await this.getStats());
        }
        if (url.pathname === "/match") {
            await this.countMatch(url.searchParams.get("e"), url.searchParams.get("code"));
            return new Response("ok");
        }
        if (url.pathname === "/quick") {
            return this.quick();
        }
        return new Response("Not found", {status: 404});
    }

    async quick() {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        const waiting = this.getWaiting()[0];
        if (waiting !== undefined) {
            // Someone's waiting: they host, this one joins
            let code = "";
            for (let i = 0; i < QUICK_CODE_LENGTH; i++) {
                code += QUICK_CODE_LETTERS[Math.floor(Math.random() * QUICK_CODE_LETTERS.length)];
            }
            try {
                waiting.send(JSON.stringify({t: "server", e: "match", code, role: "host"}));
                waiting.close(1000, "matched");
                server.accept();
                server.send(JSON.stringify({t: "server", e: "match", code, role: "guest"}));
                server.close(1000, "matched");
                return new Response(null, {status: 101, webSocket: client});
            } catch (e) {
                // They'd just gone: this one waits instead
            }
        }
        this.ctx.acceptWebSocket(server, ["waiting"]);
        server.send(JSON.stringify({t: "server", e: "queued", ...(await this.getStats())}));
        return new Response(null, {status: 101, webSocket: client});
    }

    async countMatch(event, code) {
        if (!code) {
            return;
        }
        const matches = (await this.ctx.storage.get("matches")) ?? {};
        const now = Date.now();
        for (const [other, started] of Object.entries(matches)) {
            if (now - started >= MATCH_FORGET_MS) {
                delete matches[other];
            }
        }
        if (event === "start") {
            matches[code] = now;
        } else if (matches[code] === undefined) {
            return;
        } else {
            delete matches[code];
        }
        await this.ctx.storage.put("matches", matches);
        // Whoever's waiting sees the number change
        const stats = await this.getStats();
        for (const socket of this.getWaiting()) {
            socket.send(JSON.stringify({t: "server", e: "stats", ...stats}));
        }
    }

    webSocketMessage() {
        // The waiting players don't say anything
    }

    webSocketClose(socket, code, reason) {
        try {
            socket.close(code, reason);
        } catch (e) {
            // Already closed
        }
    }
}
