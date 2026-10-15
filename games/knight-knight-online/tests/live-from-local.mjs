// The game running on this computer (no server= in the address) still uses the real server: hosting gets a code
import {sleep, launch, Page, KEYS, waitForGame} from "./cdp.mjs";
const browser = await launch(9461);
const page = new Page("local", browser.url);
try {
    await page.ready;
    await page.send("Runtime.enable");
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
    await waitForGame(page);
    await page.press(...KEYS.up);
    await page.press(...KEYS.up);
    await page.press(...KEYS.enter);
    let state = null;
    for (let i = 0; i < 40 && state !== "waiting"; i++) {
        await sleep(250);
        state = await page.eval("knightKnightOnline.online.state + ' ' + (knightKnightOnline.online.code ?? '') + ' ' + (knightKnightOnline.online.message ?? '')");
        if (state.startsWith("waiting")) break;
    }
    console.log("state: " + state);
    console.log(state.startsWith("waiting") ? "PASS" : "FAILED");
    await page.press("Escape", "Escape", 27);
} finally {
    browser.chrome.kill();
}
