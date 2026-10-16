// Screenshots of the frenzy power-up: the question mark block, then the shower of power-ups when it's picked up
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";
setShotFolder(process.argv[2]);
const browser = await launch(9463);
const page = new Page("frenzy", browser.url);
try {
    await page.ready;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {source: `localStorage.setItem("knight-knight-online-settings", JSON.stringify({arena: "MEADOW", boulders: "OFF", hazards: false}))`});
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
    await waitForGame(page);
    await page.press(...KEYS.space);
    await sleep(1600);
    await page.eval(`(() => { const k = knightKnightOnline; const s = k.captureState(); s.powerups = [new k.CLASSES.Powerup("frenzy", 120, 60)]; k.restoreState(s); })()`);
    await sleep(500);
    await page.screenshot("frenzy-block.png");
    await page.eval("knightKnightOnline.givePowerup(0, 'frenzy')");
    await sleep(250);
    await page.screenshot("frenzy-falling.png");
    await sleep(1200);
    await page.screenshot("frenzy-landed.png");
    console.log(page.errors.length ? "errors: " + page.errors.join("\n") : "no errors");
} finally {
    browser.chrome.kill();
}
