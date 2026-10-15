// Screenshots of a chicken round: blue as a chicken (with its blue comb), the countdown, the freeze, then red as one
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";
setShotFolder(process.argv[2]);
const browser = await launch(9452);
const page = new Page("chicken", browser.url);
try {
    await page.ready;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {source: `localStorage.setItem("knight-knight-online-settings", JSON.stringify({arena: "MEADOW", boulders: "OFF", hazards: false}))`});
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
    await waitForGame(page);
    await page.press(...KEYS.space);
    await sleep(1600);
    // Blue's the chicken, with a shield, 4 seconds before the swap
    await page.eval(`(() => {
        const k = knightKnightOnline;
        const s = k.captureState();
        s.chickenRound = true;
        s.chickenTicks = 6 * 160;
        s.knights[1].setChicken(true);
        k.restoreState(s);
        k.givePowerup(1, "shield");
    })()`);
    await page.key("keyDown", "ArrowLeft", "ArrowLeft", 37);
    await sleep(1200);
    await page.key("keyUp", "ArrowLeft", "ArrowLeft", 37);
    await page.screenshot("chicken-blue.png");
    await page.press(...KEYS.enter); // a chicken can't swing
    await sleep(2400);
    await page.screenshot("chicken-freeze.png");
    await sleep(1500);
    await page.screenshot("chicken-red.png");
    console.log(await page.eval("JSON.stringify(knightKnightOnline.knights.map(k => [k.player.color, k.isChicken, k.dead]))"));
    console.log(page.errors.length ? "errors: " + page.errors.join("\n") : "no errors");
} finally {
    browser.chrome.kill();
}
