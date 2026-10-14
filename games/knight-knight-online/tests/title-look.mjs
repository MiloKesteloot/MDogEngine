// Screenshots of the title screen with each online choice picked, to check the text fits
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";
setShotFolder(process.argv[2]);
const browser = await launch(9371);
const page = new Page("title", browser.url);
try {
    await page.ready;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
    await waitForGame(page);
    await sleep(1000);
    await page.screenshot("title-local.png");
    await page.press(...KEYS.down);
    await sleep(1500);
    await page.screenshot("title-quick.png");
    await page.press(...KEYS.down);
    await sleep(300);
    await page.screenshot("title-host.png");
    await page.press(...KEYS.down);
    await sleep(300);
    await page.screenshot("title-join.png");
    await page.press(...KEYS.enter);
    await page.press("a", "KeyA", 65);
    await page.press("b", "KeyB", 66);
    await sleep(200);
    await page.screenshot("join-typing.png");
    await page.press("d", "KeyD", 68);
    await page.press("e", "KeyE", 69);
    await sleep(200);
    await page.screenshot("join-typed.png");
} finally {
    browser.chrome.kill();
}
