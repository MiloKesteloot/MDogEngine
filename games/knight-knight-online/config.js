// Where the online server is (see server/README.md for setting it up). After deploying it, put its address here,
// starting with wss:// instead of https://.
export const SERVER_URL = "wss://knight-knight-online.milokesteloot.workers.dev";

// Which server to use: ?server=... in the address wins (handy for testing), then a server running on this computer
// when the game is too (npm run dev in server/), then the one above. null if it hasn't been set up.
export function getServerUrl() {
    if (typeof location === "undefined") {
        return null;
    }
    const fromAddress = new URLSearchParams(location.search).get("server");
    if (fromAddress !== null) {
        return fromAddress;
    }
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        return "ws://" + location.hostname + ":8787";
    }
    return SERVER_URL.includes("REPLACE-ME") ? null : SERVER_URL;
}
