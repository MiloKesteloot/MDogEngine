// Screenshots of stacked power-ups: three shields on blue, and red Big three times over
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";
setShotFolder(process.argv[2]);
const browser = await launch(9451);
const page = new Page("stack", browser.url);
try {
    await page.ready;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {source: `localStorage.setItem("knight-knight-online-settings", JSON.stringify({arena: "MEADOW", boulders: "OFF", hazards: false}))`});
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
    await waitForGame(page);
    await page.press(...KEYS.space);
    await sleep(1600);
    await page.eval("(() => { const k = knightKnightOnline; for (let i = 0; i < 3; i++) { k.givePowerup(1, 'shield'); k.givePowerup(0, 'grow'); } })()");
    await sleep(300);
    await page.screenshot("stack-popups.png");
    await sleep(1500);
    await page.screenshot("stack-grown.png");
    console.log(page.errors.length ? "errors: " + page.errors.join("\n") : "no errors");
} finally {
    browser.chrome.kill();
}
