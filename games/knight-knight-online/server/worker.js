// The Knight Knight Online server, a Cloudflare Worker (see README.md for setting it up).
//
// All it does is join codes. Each code is a room, run by a Durable Object (one little server per room, so both
// players reach the same one). The host connects with ?role=host and the guest with ?role=guest, over WebSockets, and
// the room passes every message from one to the other. The players use that to set up a direct connection between
// their browsers, and after that the room only carries the odd message, unless the direct connection can't be made,
// in which case the whole match goes through it.
//
// The room's own messages to the players are {t: "server", e: ...}:
//   hosting       you're the host, waiting for someone to join
//   joined        you've joined the host
//   peer-joined   (to the host) someone joined
//   peer-left     the other player's gone
//   taken         (to a host) that code's already being used, pick another
//   no-room       (to a guest) nobody's hosting that code
//   full          (to a guest) that match already has two players

import {DurableObject} from "cloudflare:workers";

const CODE = /^\/room\/([A-Z0-9]{4,8})$/;
const MAX_MESSAGE = 1024 * 1024; // big enough for a whole copy of the game (see Rollback.js)

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
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
        const role = new URL(request.url).searchParams.get("role");
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
        server.serializeAttachment({role});
        if (role === "host") {
            server.send(JSON.stringify({t: "server", e: "hosting"}));
        } else {
            server.send(JSON.stringify({t: "server", e: "joined"}));
            this.getSocket("host")?.send(JSON.stringify({t: "server", e: "peer-joined"}));
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

    webSocketClose(socket, code, reason) {
        this.leave(socket);
        try {
            socket.close(code, reason);
        } catch (e) {
            // Already closed
        }
    }

    webSocketError(socket) {
        this.leave(socket);
    }

    leave(socket) {
        const {role} = socket.deserializeAttachment() ?? {};
        const other = this.getSocket(role === "host" ? "guest" : "host");
        other?.send(JSON.stringify({t: "server", e: "peer-left"}));
        // Without its host the room's over, so the guest goes too
        if (role === "host" && other !== null) {
            other.close(4001, "host left");
        }
    }
}
