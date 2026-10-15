// Checks a local two player match still works in a real browser: the title menu, both players moving and swinging,
// the pause menu, and back to the title. node local-test.mjs [seconds] [screenshot folder]
// Needs the game served (node static-server.mjs).

import {mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";

const GAME = process.env.GAME_URL ?? "http://127.0.0.1:8000/?game=knight-knight-online";
const seconds = Number(process.argv[2] ?? 20);
const shots = process.argv[3] ?? join(tmpdir(), "knight-knight-shots");
mkdirSync(shots, {recursive: true});
setShotFolder(shots);

const browser = await launch(9321);
const page = new Page("local", browser.url);
let failed = false;
const fail = message => { failed = true; console.log("FAIL " + message); };
try {
    await page.ready;
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    await page.send("Page.navigate", {url: GAME});
    await waitForGame(page);
    await sleep(1000);

    // LOCAL MATCH is picked to start with, so Space starts it, like it always did
    await page.press(...KEYS.space);
    await sleep(300);
    const phase = await page.eval("knightKnightOnline.phase");
    if (phase !== "ready") fail("Space on the title didn't start a local match (phase " + phase + ")");
    await sleep(1200);

    const start = await page.eval("knightKnightOnline.knights.map(k => [k.x, k.y])");
    // Red walks right and blue walks left, then they swing
    await page.key("keyDown", ...KEYS.d);
    await page.key("keyDown", ...KEYS.left);
    await sleep(1200);
    await page.key("keyUp", ...KEYS.d);
    await page.key("keyUp", ...KEYS.left);
    const moved = await page.eval("knightKnightOnline.knights.map(k => [k.x, k.y])");
    if (!(moved[0][0] > start[0][0] + 20)) fail("red didn't walk right: " + JSON.stringify([start[0], moved[0]]));
    if (!(moved[1][0] < start[1][0] - 20)) fail("blue didn't walk left: " + JSON.stringify([start[1], moved[1]]));
    await page.press(...KEYS.space);
    const redSwinging = await page.eval("knightKnightOnline.knights[0].state");
    await page.press(...KEYS.enter);
    const blueSwinging = await page.eval("knightKnightOnline.knights[1].state");
    if (redSwinging !== "swing" && !(await page.eval("knightKnightOnline.knights[0].dead"))) fail("red didn't swing: " + redSwinging);
    if (blueSwinging !== "swing" && !(await page.eval("knightKnightOnline.knights[1].dead"))) fail("blue didn't swing: " + blueSwinging);
    // A left click swings for blue (whose swing is Enter)
    await sleep(600);
    await page.click();
    const clickRed = await page.eval("knightKnightOnline.knights[0].state");
    const clickBlue = await page.eval("knightKnightOnline.knights[1].state");
    if (clickBlue !== "swing" && !(await page.eval("knightKnightOnline.knights[1].dead"))) fail("a left click didn't swing for blue: " + clickBlue);
    if (clickRed === "swing") fail("a left click swung for red too");
    await page.screenshot("local-1-match.png");

    // Mash for a while
    const end = Date.now() + seconds * 1000;
    while (Date.now() < end) {
        const red = ["w", "a", "s", "d"][Math.floor(Math.random() * 4)];
        const blue = ["up", "left", "down", "right"][Math.floor(Math.random() * 4)];
        await page.key("keyDown", ...KEYS[red]);
        await page.key("keyDown", ...KEYS[blue]);
        await sleep(200 + Math.random() * 300);
        await page.key("keyUp", ...KEYS[red]);
        await page.key("keyUp", ...KEYS[blue]);
        await page.press(...KEYS[Math.random() < 0.5 ? "space" : "enter"]);
    }
    console.log("after mashing: round " + await page.eval("knightKnightOnline.roundNumber") + ", score " + JSON.stringify(await page.eval("knightKnightOnline.scores")));
    await page.screenshot("local-2-later.png");

    // The pause menu pauses
    await page.press("Escape", "Escape", 27);
    await page.press(...KEYS.down); // the menu's selector starts hidden: an arrow brings it back first
    const before = await page.eval("knightKnightOnline.gameTime");
    await sleep(500);
    const after = await page.eval("knightKnightOnline.gameTime");
    if (after !== before) fail("the pause menu didn't pause");
    await page.screenshot("local-3-paused.png");
    // TITLE SCREEN is the third choice
    await page.press(...KEYS.down);
    await page.press(...KEYS.down);
    await page.press(...KEYS.enter);
    await sleep(300);
    if (await page.eval("knightKnightOnline.phase") !== "title") fail("didn't get back to the title");
} catch (e) {
    fail(e.message);
} finally {
    if (page.errors.length > 0) {
        fail("errors:\n  " + page.errors.slice(0, 8).join("\n  "));
    }
    browser.chrome.kill();
}
console.log("screenshots in " + shots);
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
