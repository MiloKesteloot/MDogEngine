// Screenshots of the boogie bomb: its icon on the field, and a knight dancing
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";
setShotFolder(process.argv[2]);
const browser = await launch(9381);
const page = new Page("boogie", browser.url);
try {
    await page.ready;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
    await waitForGame(page);
    await sleep(800);
    await page.press(...KEYS.space);
    await sleep(2200);
    await page.eval(`(() => { const k = knightKnightOnline; k.captureState().powerups.push(new k.CLASSES.Powerup("boogie", 120, 140)); })()`);
    await sleep(300);
    await page.screenshot("boogie-1-icon.png");
    await page.eval("knightKnightOnline.givePowerup(0, 'boogie')");
    await page.key("keyDown", "ArrowLeft", "ArrowLeft", 37);
    await sleep(500);
    await page.screenshot("boogie-2-dancing.png");
    await page.key("keyUp", "ArrowLeft", "ArrowLeft", 37);
    await page.press("Enter", "Enter", 13);
    await sleep(150);
    await page.screenshot("boogie-3-cant-swing.png");
    console.log(page.errors.length ? "errors: " + page.errors.join("\n") : "no errors");
} finally {
    browser.chrome.kill();
}
