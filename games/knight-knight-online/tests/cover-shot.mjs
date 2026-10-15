// Takes a real screenshot from the game for the cover: the meadow, the two knights' swords meeting in a parry, with a
// chicken, the bear asleep, a boulder rolling in (with its track behind it) and a power-up about. The game is frozen the
// moment the swords meet, and the canvas is saved at the game's own size (240 x 180), without the score and so on.
// node cover-shot.mjs [file to save] (needs node static-server.mjs)

import {writeFileSync} from "node:fs";
import {sleep, launch, Page, KEYS, waitForGame} from "./cdp.mjs";

const out = process.argv[2] ?? "cover-shot.png";
const browser = await launch(9431);
const page = new Page("cover", browser.url);
try {
    await page.ready;
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {source: `localStorage.setItem("knight-knight-online-settings", JSON.stringify({arena: "MEADOW", boulders: "OFF", hazards: false, weather: false, killCam: "OFF"}))`});
    let frozen = false;
    for (let attempt = 0; attempt < 6 && !frozen; attempt++) {
        await page.send("Page.navigate", {url: "http://127.0.0.1:8000/?game=knight-knight-online"});
        await waitForGame(page);
        await sleep(800);
        await page.press(...KEYS.space);
        // Until the round's started
        for (let i = 0; i < 50 && await page.eval("knightKnightOnline.phase") !== "playing"; i++) {
            await sleep(100);
        }
        // The scene
        await page.eval(`(() => {
            const k = knightKnightOnline;
            k.hideUI = true;
            const s = k.captureState();
            const [red, blue] = s.knights;
            // Only the bottom left rock is left (moved down and to the left a bit), for a clear view
            s.rocks = s.rocks.filter(rock => rock.x === 76 && rock.y === 120);
            s.rocks[0].x = 72;
            s.rocks[0].y = 134;
            // And another just to the right of it, and a little lower
            s.rocks.push(new k.CLASSES.Rock(90, 140, s.arena.rockImage));
            // Face to face, either side of the middle of the shot (134). x and y are the sprite's top left: the feet
            // are 10 right and 16 down.
            red.x = 122 - 10; red.y = 120 - 16; red.facing = "east";
            blue.x = 146 - 10; blue.y = 120 - 16; blue.facing = "west";
            // The bear, fast asleep
            s.features.push(new k.CLASSES.Bear(186, 106));
            const boulder = new k.CLASSES.Boulder();
            // Already where it'll be (its trail is drawn afterwards, as a wake: see cover_title.py)
            boulder.x = 76; boulder.y = 106; boulder.landed = true; boulder.setDirection(1, 0);
            s.boulders.push(boulder);
            k.restoreState(s);
        })()`);
        for (let i = 0; i < 100 && await page.eval("knightKnightOnline.captureState().boulders[0].x") < 76; i++) {
            await sleep(30);
        }
        await page.eval(`(() => {
            const k = knightKnightOnline;
            const s = k.captureState();
            // A chicken coming for them (just clear of the tall grass), and a power-up
            s.features.push(new k.CLASSES.Chicken(151, 150));
            s.powerups.push(new k.CLASSES.Powerup("shield", 80, 98));
            k.restoreState(s);
            // Freeze the moment the swords meet
            window.coverFrozen = false;
            const watch = setInterval(() => {
                const now = k.captureState();
                if (now.hitstop > 0) {
                    now.hitstop = 1e9;
                    // Posed mid-swing with their swords out, tips meeting in the middle of the shot (not the stunned
                    // flicker after)
                    const [red, blue] = now.knights;
                    red.x = 125 - 10; blue.x = 142 - 10;
                    red.y = blue.y = 120 - 16;
                    // Red is drawn with his facing-left art, flipped, so the two are mirror images of each other
                    // (the game's facing-right and facing-left swings aren't drawn quite the same)
                    red.facing = "west";
                    red.mirrored = true;
                    for (const knight of now.knights) {
                        knight.state = "swing";
                        knight.animations.swing[knight.facing].time = 25;
                        knight.stunTicks = 0;
                    }
                    // No "PARRY!" over them: the cover's title is the only words
                    now.popups.length = 0;
                    // Butterflies caught scattering from the clash: in a loose ring round it, lifted up off the
                    // ground, flapping fast, each flying away from the swords
                    now.critters = [[-20, -10], [19, -13], [-9, -22], [13, 6], [-24, 4], [5, -26]].map(([dx, dy], i) => {
                        const butterfly = new k.CLASSES.Critter("butterflies");
                        butterfly.x = 134 + dx;
                        butterfly.y = 116 + dy;
                        butterfly.z = 12 + (i % 3) * 3;
                        butterfly.scared = 60;
                        butterfly.flap = i * 2;
                        butterfly.angle = Math.atan2(dy, dx);
                        return butterfly;
                    });
                    k.restoreState(now);
                    // Just the game's twinkle, right where the sword tips meet (the clash's sparks are left out: frozen,
                    // they're a clump, and spread out they're clutter)
                    k.clearParticles();
                    k.twinkle(133, 114);
                    window.coverFrozen = true;
                    clearInterval(watch);
                }
            }, 1);
        })()`);
        // Both swing at once
        await page.key("keyDown", ...KEYS.space);
        await page.key("keyDown", ...KEYS.enter);
        await sleep(30);
        await page.key("keyUp", ...KEYS.space);
        await page.key("keyUp", ...KEYS.enter);
        for (let i = 0; i < 20 && !frozen; i++) {
            await sleep(50);
            frozen = await page.eval("window.coverFrozen && knightKnightOnline.knights.every(k => !k.dead)");
        }
    }
    if (!frozen) {
        throw new Error("the swords never met");
    }
    await sleep(500); // the screen shake settles
    const data = await page.eval(`document.querySelector("canvas").toDataURL("image/png")`);
    writeFileSync(out, Buffer.from(data.split(",")[1], "base64"));
    // Where the boulder is, for drawing its trail (see cover_title.py)
    const boulder = await page.eval("(() => { const b = knightKnightOnline.captureState().boulders[0]; return {x: b.x, y: b.y, size: b.size}; })()");
    // And where the bear's "z" is (the game draws it at x + 6 + 4z, y - 12 - 10z, z going from 0 to 1 every 90 ticks)
    const bear = await page.eval("(() => { const b = knightKnightOnline.captureState().features.find(f => f.constructor.name === 'Bear'); return {x: b.x, y: b.y, ticks: b.ticks}; })()");
    writeFileSync(out.replace(/\.png$/, ".json"), JSON.stringify({boulder, bear}));
    console.log("saved " + out + (page.errors.length ? "\nerrors: " + page.errors.join("\n") : ""));
} finally {
    browser.chrome.kill();
}
