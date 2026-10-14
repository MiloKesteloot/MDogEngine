// A screenshot of each of the showdown's layouts (they're picked at random, so it reloads until it's seen them all)
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";
setShotFolder(process.argv[2]);
const browser = await launch(9401);
const page = new Page("showdown", browser.url);
const seen = new Set();
try {
    await page.ready;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {source: `localStorage.setItem("knight-knight-online-settings", JSON.stringify({arena: "SHOWDOWN"}))`});
    for (let tries = 0; tries < 12 && seen.size < 3; tries++) {
        await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
        await waitForGame(page);
        await sleep(600);
        await page.press(...KEYS.space);
        await sleep(1800);
        const layout = await page.eval("(() => { const k = knightKnightOnline; return k.captureState().arena.layouts.indexOf(k.arenaLayout); })()");
        if (!seen.has(layout)) {
            seen.add(layout);
            await page.screenshot(`showdown-layout-${layout}.png`);
        }
    }
    console.log("layouts seen: " + [...seen].join(", ") + (page.errors.length ? "\nerrors: " + page.errors.join("\n") : ", no errors"));
} finally {
    browser.chrome.kill();
}
