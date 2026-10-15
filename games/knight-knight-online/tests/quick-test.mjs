// Quick match in real browsers: one looks and waits, the next one to look is paired with them, and they play with the
// standard settings. Also that cancelling a search takes you out of the line. Needs the server (npm run dev in
// server/) and node static-server.mjs. node quick-test.mjs [screenshot folder]

import {mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";

const GAME = process.env.GAME_URL ?? "http://127.0.0.1:8000/?game=knight-knight-online&server=ws://127.0.0.1:8787";
const SERVER = process.env.STATS_URL ?? "http://127.0.0.1:8787";
const shots = process.argv[2] ?? join(tmpdir(), "knight-knight-shots");
mkdirSync(shots, {recursive: true});
setShotFolder(shots);

const browsers = [await launch(9351), await launch(9352)];
const [first, second] = [new Page("first", browsers[0].url), new Page("second", browsers[1].url)];
let failed = false;
const fail = message => { failed = true; console.log("FAIL " + message); };
const ok = message => console.log("ok   " + message);
const kk = (page, expression) => page.eval(`(() => { const k = knightKnightOnline, o = k.online; return ${expression}; })()`);
const waitFor = async (page, expression, what, seconds = 10) => {
    for (let i = 0; i < seconds * 5; i++) {
        if (await kk(page, expression)) return;
        await sleep(200);
    }
    throw new Error("timed out waiting for " + what + " (" + await kk(page, "o.state + ' ' + o.message") + ")");
};
const stats = async () => (await fetch(SERVER + "/stats")).json();

try {
    for (const page of [first, second]) {
        await page.ready;
        await page.send("Runtime.enable");
        await page.send("Page.enable");
        // The first player's own settings are odd, to check quick matches don't use them
        if (page === first) {
            await page.send("Page.addScriptToEvaluateOnNewDocument", {source: `localStorage.setItem("knight-knight-online-settings", JSON.stringify({roundsToWin: 10, arena: "SUMO"}))`});
        }
        await page.send("Page.navigate", {url: GAME});
    }
    await waitForGame(first);
    await waitForGame(second);
    await sleep(800);
    const startingStats = await stats();
    if (startingStats.waiting !== 0) {
        throw new Error("someone's already waiting on this server: " + JSON.stringify(startingStats));
    }

    // The first one looks at QUICK MATCH (second on the menu): nobody's waiting
    await first.press(...KEYS.down);
    await sleep(1500);
    await first.screenshot("quick-1-nobody-waiting.png");
    await first.press(...KEYS.enter);
    await waitFor(first, `o.state === "searching"`, "the first to be looking");
    await sleep(1200);
    await first.screenshot("quick-2-searching.png");
    (await stats()).waiting === 1 ? ok("the first one is waiting in line") : fail("the server doesn't show them waiting");

    // The second one looks at QUICK MATCH: someone's waiting
    await second.press(...KEYS.down);
    await sleep(1500);
    await second.screenshot("quick-3-someone-waiting.png");
    await second.press(...KEYS.enter);
    await waitFor(first, `k.mode === "online" && o.state === "playing"`, "the first one's match");
    await waitFor(second, `k.mode === "online" && o.state === "playing"`, "the second one's match");
    const roles = [await kk(first, "o.role"), await kk(second, "o.role")];
    roles[0] === "host" && roles[1] === "guest" ? ok("paired up: the one who waited hosts") : fail("roles " + roles);
    const used = await kk(second, "o.hostSettings.roundsToWin + ' ' + JSON.stringify(o.hostSettings.arenas)");
    used === "5 {}" ? ok("they play with the standard settings, not the host's own") : fail("settings used: " + used);
    await sleep(600);
    await second.screenshot("quick-4-match.png");
    await sleep(6000);
    const check = await Promise.all([first, second].map(page => kk(page, "[o.session.desyncTick, o.session.nextHashTick]")));
    if (check.some(([desync, hashed]) => desync !== null || hashed < 600)) {
        fail("the match isn't in sync: " + JSON.stringify(check));
    } else {
        ok("the match is in sync");
    }

    // Leaving: the other is told their opponent left
    await second.press("Escape", "Escape", 27);
    await second.press(...KEYS.down); // the menu's selector starts hidden: an arrow brings it back first
    await second.press(...KEYS.up);
    await second.press(...KEYS.enter);
    await waitFor(first, `o.state === "ended"`, "the first to hear they left");
    ok("leaving is noticed: " + await kk(first, "o.message"));

    // Cancelling a search takes you out of the line
    await first.press(...KEYS.enter); // back to the title
    await sleep(500);
    await first.press(...KEYS.enter); // QUICK MATCH is still picked
    await waitFor(first, `o.state === "searching"`, "looking again");
    await first.press("Escape", "Escape", 27);
    await sleep(800);
    const afterCancel = await stats();
    afterCancel.waiting === 0 && await kk(first, `o.state === "idle"`)
        ? ok("cancelling takes you out of the line") : fail("after cancelling: " + JSON.stringify(afterCancel));
} catch (e) {
    fail(e.message);
} finally {
    for (const page of [first, second]) {
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
