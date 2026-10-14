// A screenshot of the volcano after a while, boxed in by fissures
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";
setShotFolder(process.argv[2]);
const browser = await launch(9421);
const page = new Page("boxin", browser.url);
try {
    await page.ready;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {source: `localStorage.setItem("knight-knight-online-settings", JSON.stringify({arena: "VOLCANO", boulders: "OFF", hazards: false}))`});
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
    await waitForGame(page);
    await sleep(600);
    await page.press(...KEYS.space);
    for (let i = 0; i < 4; i++) {
        await sleep(12000);
        await page.screenshot(`boxin-${i + 1}.png`);
    }
    console.log(page.errors.length ? "errors: " + page.errors.join("\n") : "no errors");
} finally {
    browser.chrome.kill();
}
