// Plays a real online match between two headless Chrome browsers on this computer, through the local server, the
// way two people would: one hosts, the other types the code in, and then both press keys at each other for a while.
// Checks nothing errors, the games stay in sync, and saves screenshots.
//
// Needs the game served (python -m http.server 8000 in the repo's top folder) and the server running (npm run dev in
// server/). node browser-test.mjs [seconds] [screenshot folder]

import {mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {sleep, launch, Page, KEYS, setShotFolder} from "./cdp.mjs";

const GAME = process.env.GAME_URL ?? "http://127.0.0.1:8000/?game=knight-knight-online&server=ws://127.0.0.1:8787";
const seconds = Number(process.argv[2] ?? 30);
const shots = process.argv[3] ?? join(tmpdir(), "knight-knight-shots");
mkdirSync(shots, {recursive: true});
setShotFolder(shots);

const browsers = [await launch(9301), await launch(9302)];
const [host, guest] = [new Page("host", browsers[0].url), new Page("guest", browsers[1].url)];
let failed = false;
const fail = message => { failed = true; console.log("FAIL " + message); };
try {
    for (const page of [host, guest]) {
        await page.ready;
        await page.send("Runtime.enable");
        await page.send("Page.enable");
        if (process.env.NO_DIRECT === "1") {
            // As if the network won't allow a direct connection: everything has to go through the server
            await page.send("Page.addScriptToEvaluateOnNewDocument", {source: "delete window.RTCPeerConnection;"});
        }
        await page.send("Page.navigate", {url: GAME});
    }
    for (const page of [host, guest]) {
        let loaded = false;
        for (let i = 0; i < 100 && !loaded; i++) {
            await sleep(200);
            loaded = await page.eval(`typeof knightKnightOnline === "object"`).catch(e => { if (i % 20 === 19) console.log(page.name, "eval:", e.message); return false; });
        }
        if (!loaded) {
            console.log(page.logs.slice(0, 10).join("\n"), await page.eval("location.href + document.body.innerHTML.slice(0, 200)"));
            throw new Error(page.name + "'s game never loaded");
        }
        // The title menu's selector starts hidden: an arrow brings it back (on the first choice)
        await page.press(...KEYS.down);
    }
    // Sitting on the title screen for a while first, like people do
    await sleep(Number(process.env.TITLE_WAIT ?? 1500));
    await host.screenshot("1-title.png");

    // Host: down to HOST ONLINE MATCH, and pick it
    await host.press(...KEYS.up); // HOST ONLINE MATCH is second from the bottom
    await host.press(...KEYS.up);
    await host.press(...KEYS.enter);
    let code = null;
    for (let i = 0; i < 50 && code === null; i++) {
        await sleep(200);
        code = await host.eval(`knightKnightOnline.online.state === "waiting" ? knightKnightOnline.online.code : null`);
    }
    if (code === null) {
        throw new Error("The host never got a code: " + await host.eval("knightKnightOnline.online.state + ' ' + knightKnightOnline.online.message"));
    }
    console.log("host's code: " + code);
    await host.screenshot("2-hosting.png");

    // Guest: down twice to JOIN ONLINE MATCH, type the code, and join
    await guest.press(...KEYS.up); // JOIN ONLINE MATCH is at the bottom
    await guest.press(...KEYS.enter);
    for (const letter of code) {
        await guest.press(letter.toLowerCase(), /[0-9]/.test(letter) ? "Digit" + letter : "Key" + letter, letter.charCodeAt(0));
    }
    await guest.screenshot("3-joining.png");
    await guest.press(...KEYS.enter);

    let playing = false;
    for (let i = 0; i < 60 && !playing; i++) {
        await sleep(200);
        playing = await host.eval(`knightKnightOnline.mode === "online"`) && await guest.eval(`knightKnightOnline.mode === "online"`);
    }
    if (!playing) {
        throw new Error("The match never started: host " + await host.eval("knightKnightOnline.online.state") + ", guest " + await guest.eval("knightKnightOnline.online.state + ' ' + knightKnightOnline.online.message"));
    }
    console.log("the match started");
    await sleep(600);
    await host.screenshot("4-host-ready.png");
    await guest.screenshot("4-guest-ready.png");

    // Both walk at each other and swing, for a while
    const end = Date.now() + seconds * 1000;
    let shot = 0;
    const play = async (page, keys, swing) => {
        while (Date.now() < end) {
            const dir = keys[Math.floor(Math.random() * keys.length)];
            await page.key("keyDown", ...KEYS[dir]);
            await sleep(150 + Math.random() * 500);
            await page.key("keyUp", ...KEYS[dir]);
            if (Math.random() < 0.6) {
                await page.press(...KEYS[swing]);
            }
        }
    };
    const shooter = (async () => {
        while (Date.now() < end) {
            await sleep(seconds * 1000 / 4);
            shot++;
            await host.screenshot(`5-host-${shot}.png`);
            await guest.screenshot(`5-guest-${shot}.png`);
        }
    })();
    await Promise.all([play(host, ["d", "d", "w", "s", "a"], "space"), play(guest, ["left", "left", "up", "down", "right"], "enter"), shooter]);

    const report = page => page.eval(`(() => {
        const o = knightKnightOnline.online, s = o.session;
        return {state: o.state, tick: s?.tick, rollbacks: s?.rollbacks, desync: s?.desyncTick, rtt: Math.round(o.rtt),
            direct: o.connection?.direct, delay: s?.delay, round: knightKnightOnline.roundNumber, scores: knightKnightOnline.scores,
            hashesChecked: s?.nextHashTick, replayFrames: knightKnightOnline.killCam.frames.length, replaying: knightKnightOnline.replayTicksLeft > 0,
            replayBehind: knightKnightOnline.killCam.frames.length === 0 ? null
                : knightKnightOnline.simTicks - knightKnightOnline.killCam.frames.at(-1).tick};
    })()`);
    const results = {host: await report(host), guest: await report(guest)};
    console.log(JSON.stringify(results, null, 1));
    for (const [name, result] of Object.entries(results)) {
        if (result.state !== "playing") fail(name + " isn't playing any more: " + result.state);
        if (result.desync !== null) fail(name + " found the games out of sync at tick " + result.desync);
        if (!(result.hashesChecked > 800)) fail(name + " hardly compared fingerprints");
        // (Nothing's recorded while a replay plays)
        if (!result.replaying && (!(result.replayFrames > 10) || !(result.replayBehind < 40))) {
            fail(name + "'s kill cam isn't recording (" + result.replayFrames + " frames, newest " + result.replayBehind + " ticks old)");
        }
    }
    if (JSON.stringify(results.host.scores) !== JSON.stringify(results.guest.scores) && Math.abs(results.host.tick - results.guest.tick) < 50) {
        console.log("note: scores differ right now (they can, for a moment, while one's ahead)");
    }

    // Leaving: the other one hears
    await guest.press("Escape", "Escape", 27);
    await guest.press(...KEYS.down); // the menu's selector starts hidden: an arrow brings it back first
    await sleep(300);
    await guest.screenshot("6-guest-menu.png");
    // LEAVE MATCH is last on the menu: up from the top wraps round to it
    await guest.press(...KEYS.up);
    await guest.press(...KEYS.enter);
    await sleep(1500);
    const hostState = await host.eval("knightKnightOnline.online.state + ': ' + knightKnightOnline.online.message");
    console.log("after the guest left, the host sees: " + hostState);
    if (!hostState.startsWith("ended")) fail("the host didn't notice the guest leaving");
    await host.screenshot("7-host-after-leave.png");
    await guest.screenshot("7-guest-title.png");
    if (await guest.eval("knightKnightOnline.mode") !== "local") fail("the guest didn't go back to the title");
} catch (e) {
    fail(e.message);
} finally {
    for (const page of [host, guest]) {
        if (page.errors.length > 0) {
            fail(page.name + " had errors:\n  " + page.errors.slice(0, 8).join("\n  "));
        }
        const warnings = page.logs.filter(log => log.startsWith("warn"));
        if (warnings.length > 0) {
            console.log(page.name + " warnings:\n  " + warnings.slice(0, 8).join("\n  "));
        }
    }
    for (const {chrome} of browsers) {
        chrome.kill();
    }
}
console.log("screenshots in " + shots);
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
