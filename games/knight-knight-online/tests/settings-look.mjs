// Screenshots of the settings menus: the main one, hazards, and the arena picker (turning a few arenas off),
// and checks the picker's keys and clicks change the settings. node settings-look.mjs [screenshot folder]
import {sleep, launch, Page, KEYS, setShotFolder, waitForGame} from "./cdp.mjs";
setShotFolder(process.argv[2]);
const browser = await launch(9462);
const page = new Page("settings", browser.url);
let failed = false;
const check = (what, good) => { if (!good) failed = true; console.log((good ? "ok   " : "FAIL ") + what); };
try {
    await page.ready;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {source: `localStorage.setItem("knight-knight-online-settings", JSON.stringify({arena: "MIXED", hazards: true}))`});
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
    await waitForGame(page);
    await page.press("Escape", "Escape", 27); // the settings, from the title screen
    await sleep(300);
    await page.press(...KEYS.down); // shows the selector, on ROUNDS TO WIN
    await page.press(...KEYS.down); // ARENAS
    await sleep(200);
    await page.screenshot("settings-main.png");
    await page.press(...KEYS.enter); // the arena picker
    await sleep(300);
    await page.press(...KEYS.right); // (shows the selector, on MEADOW)
    await page.press(...KEYS.right); // RIVER
    await page.press(...KEYS.enter); // RIVER off
    await page.press(...KEYS.down); // LIGHTHOUSE
    await page.press(...KEYS.down); // SUMO
    await page.press(...KEYS.enter); // SUMO off
    await sleep(200);
    // A click on SNOW's picture (third along the top) turns it off too, then another turns it back on
    const snow = await page.gameToPage(120, 41);
    await page.mouseTo(snow.x, snow.y);
    await page.click(snow.x, snow.y);
    await sleep(200);
    const clicked = await page.eval("JSON.parse(localStorage.getItem('knight-knight-online-settings')).arenas.SNOW");
    check("clicking SNOW's picture turned it off", clicked === false);
    await page.screenshot("settings-arenas.png");
    await page.click(snow.x, snow.y);
    await sleep(200);
    const arenas = await page.eval("JSON.stringify(JSON.parse(localStorage.getItem('knight-knight-online-settings')).arenas)");
    check("turned RIVER and SUMO off with the keys: " + arenas, arenas === JSON.stringify({RIVER: false, SUMO: false, SNOW: true}));
    await page.press("Escape", "Escape", 27);
    await sleep(200);
    await page.press(...KEYS.down); // POWER-UPS
    await page.press(...KEYS.down); // HAZARDS
    await page.press(...KEYS.enter);
    await sleep(300);
    await page.press(...KEYS.down); // (shows the selector, on BOULDERS)
    await page.press(...KEYS.down); // SHAKY GROUND
    await page.press(...KEYS.down); // RUNAWAY HORSES
    await page.press(...KEYS.enter); // off
    await sleep(200);
    await page.screenshot("settings-hazards.png");
    const hazards = await page.eval("JSON.stringify(JSON.parse(localStorage.getItem('knight-knight-online-settings')).hazards)");
    check("turned horses off: " + hazards, hazards === JSON.stringify({horse: false}));
    await page.press("Escape", "Escape", 27);
    await page.press(...KEYS.down); // WEATHER
    await page.press(...KEYS.down); // GAME MODES
    await page.press(...KEYS.enter);
    await sleep(300);
    await page.press(...KEYS.down); // (shows the selector, on NORMAL ROUNDS)
    // Everything off but jousts: normal rounds, juggernauts, chickens, showdowns
    for (let i = 0; i < 4; i++) {
        await page.press(...KEYS.enter);
        await page.press(...KEYS.down);
    }
    await page.press(...KEYS.enter); // jousts off: not allowed, it's the last one
    await sleep(200);
    await page.screenshot("settings-modes.png");
    const modes = await page.eval("(() => { const v = JSON.parse(localStorage.getItem('knight-knight-online-settings')); return [v.normalRounds, v.juggernaut, v.chickenRounds, v.arenas.SHOWDOWN, v.arenas.JOUST].join(); })()");
    check("only jousts on, and the last one can't be turned off: " + modes, modes === "false,false,false,false,");
    await page.press("Escape", "Escape", 27);
    await page.press("Escape", "Escape", 27);
    await sleep(300);
    console.log(page.errors.length ? "errors: " + page.errors.join("\n") : "no errors");
    if (page.errors.length) failed = true;
} finally {
    browser.chrome.kill();
}
console.log(failed ? "FAILED" : "PASS");
