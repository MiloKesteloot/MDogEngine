// Invite links: the host presses C to copy a link (the address they're on, plus the code), and opening it joins the
// match straight away. Needs the server (npm run dev in server/) and node static-server.mjs. node invite-test.mjs

import {sleep, launch, Page, KEYS, waitForGame} from "./cdp.mjs";

const GAME = (process.env.GAME_URL ?? "http://127.0.0.1:8000/?game=knight-knight-online&server=ws://127.0.0.1:8787") + "&extra=keep";
const browsers = [await launch(9361), await launch(9362)];
const [host, guest] = [new Page("host", browsers[0].url), new Page("guest", browsers[1].url)];
let failed = false;
const fail = message => { failed = true; console.log("FAIL " + message); };
const ok = message => console.log("ok   " + message);
const kk = (page, expression) => page.eval(`(() => { const k = knightKnightOnline, o = k.online; return ${expression}; })()`);
const waitFor = async (page, expression, what) => {
    for (let i = 0; i < 50; i++) {
        if (await kk(page, expression)) return;
        await sleep(200);
    }
    throw new Error("timed out waiting for " + what);
};

try {
    for (const page of [host, guest]) {
        await page.ready;
        await page.send("Runtime.enable");
        await page.send("Page.enable");
    }
    await host.send("Page.navigate", {url: GAME});
    await waitForGame(host);
    await sleep(500);
    await host.press(...KEYS.up); // HOST ONLINE MATCH is second from the bottom
    await host.press(...KEYS.up);
    await host.press(...KEYS.enter);
    await waitFor(host, `o.state === "waiting"`, "the host's code");
    const code = await kk(host, "o.code");

    // What C copies (reading the clipboard needs permission, so it's checked if it can be)
    await host.press("c", "KeyC", 67);
    await sleep(300);
    const link = await kk(host, "k.inviteLink()");
    console.log("     the link: " + link);
    const url = new URL(link);
    url.searchParams.get("code") === code && url.searchParams.get("extra") === "keep" && url.searchParams.get("game") === "knight-knight-online"
        ? ok("the link is the host's address plus the code") : fail("the link: " + link);
    const copied = await host.eval("navigator.clipboard.readText().catch(() => null)");
    if (copied !== null) {
        copied === link ? ok("C copied it") : fail("C copied " + copied);
    } else {
        console.log("     (couldn't read the clipboard here to check C copied it)");
    }

    // The host opens the match settings and changes the rounds to win (5 to 7), and is still in the menu when the
    // friend joins
    await host.press(...KEYS.enter);
    await host.press(...KEYS.down); // the menu's selector starts hidden: an arrow brings it back first
    await host.press(...KEYS.right);
    await sleep(200);

    // The guest just opens it
    await guest.send("Page.navigate", {url: link});
    await waitForGame(guest);
    await waitFor(guest, `k.mode === "online" && o.state === "playing"`, "the guest to be in the match");
    await waitFor(host, `k.mode === "online" && o.state === "playing"`, "the host to be in the match");
    ok("opening the link joined the match straight away");
    // Online, a left click swings for your own knight (the guest is blue, the host red)
    await waitFor(host, `k.phase === "playing"`, "the round to start");
    await host.click();
    await waitFor(host, `k.knights[0].state === "swing"`, "the host's click to swing red");
    ok("a left click swings your own knight online");
    const rounds = await kk(guest, "o.hostSettings.roundsToWin");
    rounds === 7 ? ok("the friend joining closed the host's settings, and the match has what was picked: first to 7")
        : fail("the match is first to " + rounds);
    const after = await guest.eval("location.href");
    !after.includes("code=") && after.includes("extra=keep")
        ? ok("the code's gone from the guest's address after joining: " + after) : fail("the guest's address after joining: " + after);
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
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
