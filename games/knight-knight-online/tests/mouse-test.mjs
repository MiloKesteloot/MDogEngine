// Menus with the mouse: hovering selects (moving the yellow selector there), moving off selects nothing, an arrow
// brings the selector back, and clicking picks. The selector starts hidden. And a click on a menu isn't a swing.
// node mouse-test.mjs (needs node static-server.mjs)
import {sleep, launch, Page, KEYS} from "./cdp.mjs";

const browser = await launch(9441);
const page = new Page("mouse", browser.url);
let failed = false;
const check = (what, good) => { console.log((good ? "ok   " : "FAIL ") + what); if (!good) failed = true; };
const kk = expression => page.eval(`(() => { const k = knightKnightOnline; return ${expression}; })()`);
try {
    await page.ready;
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
    for (let i = 0; i < 100 && !(await page.eval(`typeof knightKnightOnline === "object"`).catch(() => false)); i++) await sleep(200);
    await sleep(500);

    check("the title's selector starts hidden", await kk("k.titleSelection") === -1);
    // The title's choices are at y 102, 112, 122, 132 (in game pixels), in the middle
    const quick = await page.gameToPage(120, 112);
    await page.mouseTo(quick.x, quick.y);
    check("hovering QUICK MATCH selects it", await kk("k.titleSelection") === 1);
    const host = await page.gameToPage(120, 122);
    await page.mouseTo(host.x, host.y);
    check("hovering HOST ONLINE MATCH selects that", await kk("k.titleSelection") === 2);
    const off = await page.gameToPage(20, 60);
    await page.mouseTo(off.x, off.y);
    check("moving off the choices selects nothing", await kk("k.titleSelection") === -1);
    await page.press(...KEYS.down);
    check("an arrow brings the selector back where it was", await kk("k.titleSelection") === 2);
    await page.press(...KEYS.down);
    check("and the next one moves it", await kk("k.titleSelection") === 3);

    // Clicking LOCAL MATCH starts one
    const local = await page.gameToPage(120, 102);
    await page.mouseTo(local.x, local.y);
    await page.click(local.x, local.y);
    await sleep(200);
    check("clicking LOCAL MATCH starts a local match", await kk("k.phase") === "ready");
    for (let i = 0; i < 30 && await kk("k.phase") !== "playing"; i++) await sleep(100);

    // The pause menu
    await page.press("Escape", "Escape", 27);
    check("the pause menu's selector starts hidden", await kk("k.menuSelection") === -1);
    // Its items are at y 64, 78, 92, 106
    const resume = await page.gameToPage(120, 64);
    await page.mouseTo(resume.x, resume.y);
    check("hovering RESUME selects it", await kk("k.menuSelection") === 0);
    const hitboxes = await page.gameToPage(120, 106);
    await page.mouseTo(hitboxes.x, hitboxes.y);
    check("hovering HITBOXES selects it", await kk("k.menuSelection") === 3);
    await page.mouseTo(off.x, off.y);
    check("moving off selects nothing", await kk("k.menuSelection") === -1);
    await page.mouseTo(resume.x, resume.y);
    await page.click(resume.x, resume.y);
    await sleep(150);
    check("clicking RESUME closes the menu", await kk("k.menuSelection") === null);
    check("and the click didn't swing blue's sword (a click on a menu isn't a swing)", await kk("k.knights[1].state") !== "swing");
    if (page.errors.length > 0) check("no errors: " + page.errors.join("; "), false);
} catch (e) {
    check(e.message, false);
} finally {
    browser.chrome.kill();
}
console.log(failed ? "FAILED" : "PASS");
process.exit(failed ? 1 : 0);
