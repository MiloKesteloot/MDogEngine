// Screenshots of a fissure on the volcano: cracking (the warning), open, and closing
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";
setShotFolder(process.argv[2]);
const browser = await launch(9391);
const page = new Page("volcano", browser.url);
const state = () => page.eval(`(() => { const f = knightKnightOnline.captureState().holes.find(h => h.constructor.name === "Fissure"); return f ? f.state : null; })()`);
const waitFor = async wanted => { for (let i = 0; i < 300 && await state() !== wanted; i++) await sleep(50); };
try {
    await page.ready;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {source: `localStorage.setItem("knight-knight-online-settings", JSON.stringify({arena: "VOLCANO", boulders: "OFF"}))`});
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
    await waitForGame(page);
    await sleep(800);
    await page.press(...KEYS.space);
    await waitFor("cracking");
    await sleep(900);
    await page.screenshot("volcano-1-cracking.png");
    await waitFor("open");
    await sleep(300);
    await page.screenshot("volcano-2-open.png");
    await waitFor("closing");
    await sleep(250);
    await page.screenshot("volcano-3-closing.png");
    console.log(page.errors.length ? "errors: " + page.errors.join("\n") : "no errors");
} finally {
    browser.chrome.kill();
}
