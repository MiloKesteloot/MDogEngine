// Screenshots of a chicken round's swap (feathers flying while it's held) and a chicken knocked down (the roast)
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";
setShotFolder(process.argv[2]);
const browser = await launch(9464);
const page = new Page("roast", browser.url);
try {
    await page.ready;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {source: `localStorage.setItem("knight-knight-online-settings", JSON.stringify({arena: "MEADOW", boulders: "OFF", hazards: false}))`});
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
    await waitForGame(page);
    await page.press(...KEYS.space);
    await sleep(1600);
    // Blue's the chicken, a moment before the swap
    await page.eval(`(() => {
        const k = knightKnightOnline;
        const s = k.captureState();
        s.chickenRound = true;
        s.chickenTicks = 10 * 160 - 30;
        s.knights[1].setChicken(true);
        k.restoreState(s);
    })()`);
    await sleep(700);
    await page.screenshot("swap-held.png");
    await sleep(1000);
    // Red (now the chicken) next to blue, who swings
    await page.eval(`(() => {
        const k = knightKnightOnline;
        const [red, blue] = k.knights;
        red.x = 124 - 10; red.y = 120 - 16;
        blue.x = 112 - 10; blue.y = 120 - 16; blue.facing = "east";
    })()`);
    await page.press(...KEYS.enter);
    await sleep(1500);
    await page.screenshot("roast.png");
    console.log(await page.eval("JSON.stringify(knightKnightOnline.knights.map(k => [k.player.color, k.isChicken, k.dead]))"));
    console.log(page.errors.length ? "errors: " + page.errors.join("\n") : "no errors");
} finally {
    browser.chrome.kill();
}
