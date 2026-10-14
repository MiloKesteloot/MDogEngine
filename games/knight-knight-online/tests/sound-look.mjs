// Renders the western wail without speakers (an OfflineAudioContext in headless Chrome) and measures it: how long it
// is, and its pitch over time, to check it's what it's meant to be. node sound-look.mjs [name of the sound]
import {sleep, launch, Page} from "./cdp.mjs";
const name = process.argv[2] ?? "western";
const browser = await launch(9411);
const page = new Page("sound", browser.url);
try {
    await page.ready;
    await page.send("Runtime.enable");
    await page.send("Page.navigate", {url: "http://127.0.0.1:8000/index.html"});
    await sleep(800);
    const result = await page.eval(`(async () => {
        const {default: Sound} = await import("/games/knight-knight-online/Sound.js");
        const sound = new Sound();
        const rate = 44100;
        sound.context = new OfflineAudioContext(1, rate * 3, rate);
        sound.master = sound.context.createGain();
        sound.master.connect(sound.context.destination);
        sound.isReady = () => true;
        sound.${name}();
        const samples = (await sound.context.startRendering()).getChannelData(0);
        // Pitch every 50ms, by autocorrelation; and when it's loud enough to hear
        const out = [];
        let first = null, last = null;
        for (let at = 0; at + 2048 < samples.length; at += rate * 0.05) {
            const start = Math.floor(at);
            let energy = 0;
            for (let i = 0; i < 2048; i++) energy += samples[start + i] ** 2;
            const loud = Math.sqrt(energy / 2048);
            if (loud < 0.003) continue;
            if (first === null) first = at / rate;
            last = at / rate;
            let best = 0, bestLag = 0;
            for (let lag = 20; lag < 400; lag++) {
                let sum = 0;
                for (let i = 0; i < 1024; i++) sum += samples[start + i] * samples[start + i + lag];
                if (sum > best) { best = sum; bestLag = lag; }
            }
            out.push((at / rate).toFixed(2) + "s " + Math.round(rate / bestLag) + "Hz");
        }
        return {heard: first === null ? "nothing" : first.toFixed(2) + "s to " + last.toFixed(2) + "s", pitch: out.join(", ")};
    })()`);
    console.log(JSON.stringify(result, null, 1));
} finally {
    browser.chrome.kill();
}
