// The online extras in real browsers: the host's settings shown on the title menu and to the guest, the alert when a
// friend joins, the lobby between matches (the host changes a setting, the guest sees it, and a new match starts),
// and the connection details (F3). Needs the server (npm run dev in server/) and node static-server.mjs.
// node lobby-test.mjs [screenshot folder]

import {mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";

const GAME = process.env.GAME_URL ?? "http://127.0.0.1:8000/?game=knight-knight-online";
const shots = process.argv[2] ?? join(tmpdir(), "knight-knight-shots");
mkdirSync(shots, {recursive: true});
setShotFolder(shots);

const browsers = [await launch(9341), await launch(9342)];
const [host, guest] = [new Page("host", browsers[0].url), new Page("guest", browsers[1].url)];
let failed = false;
const fail = message => { failed = true; console.log("FAIL " + message); };
const ok = message => console.log("ok   " + message);
const kk = (page, expression) => page.eval(`(() => { const k = knightKnightOnline, o = k.online; return ${expression}; })()`);
const waitFor = async (page, expression, what, seconds = 10) => {
    for (let i = 0; i < seconds * 5; i++) {
        if (await kk(page, expression)) return true;
        await sleep(200);
    }
    throw new Error("timed out waiting for " + what);
};

try {
    for (const page of [host, guest]) {
        await page.ready;
        await page.send("Runtime.enable");
        await page.send("Page.enable");
        // The host's settings: first to 3, on the meadow
        if (page === host) {
            await page.send("Page.addScriptToEvaluateOnNewDocument", {source: `localStorage.setItem("knight-knight-online-settings", JSON.stringify({roundsToWin: 3, arena: "MEADOW"}))`});
        }
        await page.send("Page.navigate", {url: GAME});
    }
    await waitForGame(host);
    await waitForGame(guest);
    await sleep(800);

    // Hovering HOST ONLINE MATCH shows the settings
    await host.press(...KEYS.up); // HOST ONLINE MATCH is second from the bottom
    await host.press(...KEYS.up);
    await sleep(200);
    await host.screenshot("lobby-1-title-host-hover.png");
    await host.press(...KEYS.enter);
    await waitFor(host, `o.state === "waiting"`, "the host's code");
    const code = await kk(host, "o.code");
    await sleep(300);
    await host.screenshot("lobby-1b-host-waiting.png");

    // While waiting, the host opens the settings and changes the rounds to win (the first thing): 3 to 5
    await host.press(...KEYS.enter);
    await sleep(200);
    await host.screenshot("lobby-1c-host-waiting-settings.png");
    await host.press(...KEYS.right);
    await host.press("Escape", "Escape", 27);
    await sleep(200);
    (await kk(host, `o.state === "waiting"`)) ? ok("the host changed a setting while waiting, and is still waiting") : fail("the host isn't waiting any more");

    // The guest joins
    await guest.press(...KEYS.up); // JOIN ONLINE MATCH is at the bottom
    await guest.press(...KEYS.enter);
    for (const letter of code) {
        await guest.press(letter.toLowerCase(), /[0-9]/.test(letter) ? "Digit" + letter : "Key" + letter, letter.charCodeAt(0));
    }
    await guest.press(...KEYS.enter);
    await waitFor(guest, `o.state === "syncing" && o.hostSettings !== null`, "the guest getting the settings");
    await guest.screenshot("lobby-2-guest-get-ready.png");
    const seen = await kk(guest, "o.hostSettings.roundsToWin + ' ' + o.hostSettings.arena");
    seen === "5 MEADOW" ? ok("the guest sees the host's settings (changed while waiting) before the match: " + seen) : fail("the guest saw " + seen);
    const title = await host.eval("document.title");
    console.log("     the host's tab title when the friend joined: " + title + " (it only flashes when the host isn't looking at the tab)");

    await waitFor(host, `k.mode === "online" && o.state === "playing"`, "the match to start");
    await waitFor(guest, `k.mode === "online" && o.state === "playing"`, "the guest's match to start");
    ok("the match started");

    // Connection details
    await host.press("F3", "F3", 114);
    await sleep(1500);
    await host.screenshot("lobby-3-connection-info.png");

    // Back to the lobby (as if from the menu after the match)
    await sleep(1000);
    await host.eval("knightKnightOnline.online.toLobby()");
    await waitFor(guest, `o.state === "lobby"`, "the guest to go to the lobby");
    ok("both went to the lobby");
    await sleep(500);
    await host.screenshot("lobby-4-host-menu.png");
    await guest.screenshot("lobby-5-guest-waiting.png");

    // The host changes ROUNDS TO WIN (the first thing on the menu): 5 to 7
    await host.press(...KEYS.right);
    await waitFor(guest, `o.hostSettings.roundsToWin === 7`, "the guest to see the new setting", 5);
    ok("the guest saw the host change the rounds to win, live");
    await guest.screenshot("lobby-6-guest-sees-change.png");

    // Down to START MATCH (after the 9 settings)
    for (let i = 0; i < 9; i++) {
        await host.press(...KEYS.down);
    }
    await host.press(...KEYS.enter);
    await waitFor(host, `o.state === "playing"`, "the new match on the host");
    await waitFor(guest, `o.state === "playing"`, "the new match on the guest");
    const rounds = [await kk(host, "k.scores && o.hostSettings.roundsToWin"), await kk(guest, "o.hostSettings.roundsToWin")];
    rounds[0] === 7 && rounds[1] === 7 ? ok("a new match started with the new settings") : fail("new match settings: " + rounds);
    await sleep(8000);
    const check = await Promise.all([host, guest].map(page => kk(page, "[o.session.desyncTick, o.session.nextHashTick, k.roundNumber]")));
    if (check.some(([desync, hashed]) => desync !== null || hashed < 800)) {
        fail("the new match isn't in sync: " + JSON.stringify(check));
    } else {
        ok("the new match is in sync (fingerprints checked to tick " + check[0][1] + ")");
    }
    await host.screenshot("lobby-7-new-match.png");
} catch (e) {
    fail(e.message);
} finally {
    for (const page of [host, guest]) {
        if (page.errors.length > 0) {
            fail(page.name + " had errors:\n  " + page.errors.slice(0, 8).join("\n  "));
        }
    }
    for (const {chrome} of browsers) {
        chrome.kill();
    }
}
console.log("screenshots in " + shots);
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
