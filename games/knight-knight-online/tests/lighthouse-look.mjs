// Screenshots of lightning on the dark lighthouse island: the target lit up, then the strike lighting everything
import {mkdirSync} from "node:fs";
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";
const shots = process.argv[2];
mkdirSync(shots, {recursive: true});
setShotFolder(shots);
const browser = await launch(9331);
const page = new Page("look", browser.url);
try {
    await page.ready;
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {source: `localStorage.setItem("knight-knight-online-settings", JSON.stringify({arena: "LIGHTHOUSE"}))`});
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
    await waitForGame(page);
    await sleep(800);
    await page.press(...KEYS.space);
    await sleep(2500);
    await page.eval("knightKnightOnline.strikeAt(70, 130)");
    await sleep(600);
    await page.screenshot("lighthouse-1-target.png");
    await sleep(670);
    await page.screenshot("lighthouse-2-strike.png");
    await page.screenshot("lighthouse-3-after.png");
    await sleep(700);
    await page.screenshot("lighthouse-4-dark-again.png");
    console.log(page.errors.length ? "errors: " + page.errors.join("\n") : "no errors");
} finally {
    browser.chrome.kill();
}
