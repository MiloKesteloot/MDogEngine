// Where the online server is (see server/README.md for setting it up). After deploying it, put its address here,
// starting with wss:// instead of https://.
export const SERVER_URL = "wss://knight-knight-online.milokesteloot.workers.dev";

// Where the game is on the portfolio site. Invite links (C on the code screen) point here, and the page there passes
// the code on to the game (see knight-knight.html in the portfolio).
export const SHARE_URL = "https://milo.games/knight-knight";

// Which server to use: ?server=... in the address wins (the tests use that for a server running on this computer,
// npm run dev in server/), then the one above, even when the game itself is running on this computer. null if it
// hasn't been set up.
export function getServerUrl() {
    if (typeof location === "undefined") {
        return null;
    }
    const fromAddress = new URLSearchParams(location.search).get("server");
    if (fromAddress !== null) {
        return fromAddress;
    }
    return SERVER_URL.includes("REPLACE-ME") ? null : SERVER_URL;
}
