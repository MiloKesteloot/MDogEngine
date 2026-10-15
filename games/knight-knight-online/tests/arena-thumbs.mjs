// Makes the arena picker's pictures: a screenshot of each arena as a round starts (with nothing over it), saved at the
// game's size. Shrink them with arena_thumbs.py. node arena-thumbs.mjs [folder] (needs node static-server.mjs)
import {writeFileSync, mkdirSync} from "node:fs";
import {join} from "node:path";
import {sleep, launch, Page, KEYS, waitForGame} from "./cdp.mjs";

const out = process.argv[2] ?? "arena-shots";
mkdirSync(out, {recursive: true});
const NAMES = ["MEADOW", "RIVER", "SNOW", "VOLCANO", "FOREST", "MINE", "LIGHTHOUSE", "BRIDGE", "LAVALAKE", "RING", "STORM", "SUMO", "SHIP", "SHOWDOWN", "JOUST"];
const browser = await launch(9461);
const page = new Page("thumbs", browser.url);
try {
    await page.ready;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    for (const name of NAMES) {
        const values = {arena: name, arenas: Object.fromEntries(NAMES.map(other => [other, other === name])), boulders: "OFF", hazards: false, weather: false, weathers: {wind: false, rain: false, snow: false, ash: false}};
        await page.send("Page.navigate", {url: "about:blank"});
        await page.eval(`void 0`);
        await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
        await sleep(300);
        await page.eval(`localStorage.setItem("knight-knight-online-settings", ${JSON.stringify(JSON.stringify(values))})`);
        await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
        await waitForGame(page);
        await page.press(...KEYS.space);
        await sleep(900);
        await page.eval("knightKnightOnline.hideUI = true");
        await sleep(200);
        const arena = await page.eval("knightKnightOnline.arenaName");
        if (arena !== name) throw new Error("wanted " + name + ", got " + arena);
        const data = await page.eval(`document.querySelector("canvas").toDataURL("image/png")`);
        writeFileSync(join(out, name.toLowerCase() + ".png"), Buffer.from(data.split(",")[1], "base64"));
        console.log("saved " + name);
    }
} finally {
    browser.chrome.kill();
}
