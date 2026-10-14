// Driving headless Chrome over the DevTools protocol, for the browser tests

import {spawn} from "node:child_process";
import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
export let shots = join(tmpdir(), "knight-knight-shots");
export function setShotFolder(folder) {
    shots = folder;
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function launch(port) {
    const profile = mkdtempSync(join(tmpdir(), "kk-chrome-"));
    const chrome = spawn(CHROME, [
        "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run",
        "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--autoplay-policy=no-user-gesture-required",
        // Silent: the tests play the game, and nobody wants to hear it. (Sounds can still be measured without
        // speakers, see sound-look.mjs.) SOUND=1 lets it be heard.
        ...(process.env.SOUND === "1" ? [] : ["--mute-audio"]),
        "--window-size=960,720", "about:blank",
    ], {stdio: "ignore"});
    for (let i = 0; i < 50; i++) {
        try {
            const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
            const page = targets.find(target => target.type === "page");
            if (page !== undefined) {
                return {chrome, url: page.webSocketDebuggerUrl};
            }
        } catch (e) {
            // Not up yet
        }
        await sleep(200);
    }
    throw new Error("Chrome didn't start");
}

export class Page {
    constructor(name, url) {
        this.name = name;
        this.socket = new WebSocket(url);
        this.nextId = 1;
        this.pending = new Map();
        this.errors = [];
        this.logs = [];
        this.ready = new Promise(resolve => this.socket.addEventListener("open", resolve));
        this.socket.addEventListener("message", event => {
            const message = JSON.parse(event.data);
            if (message.id !== undefined) {
                const {resolve, reject} = this.pending.get(message.id);
                this.pending.delete(message.id);
                message.error ? reject(new Error(message.error.message)) : resolve(message.result);
            } else if (message.method === "Runtime.exceptionThrown") {
                this.errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
            } else if (message.method === "Runtime.consoleAPICalled") {
                const text = message.params.args.map(arg => arg.value ?? arg.description ?? "").join(" ");
                this.logs.push(message.params.type + ": " + text);
                if (message.params.type === "error") {
                    this.errors.push(text);
                }
            }
        });
    }

    send(method, params = {}) {
        const id = this.nextId++;
        this.socket.send(JSON.stringify({id, method, params}));
        return new Promise((resolve, reject) => this.pending.set(id, {resolve, reject}));
    }

    async eval(expression) {
        const result = await this.send("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
        if (result.exceptionDetails !== undefined) {
            throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
        }
        return result.result.value;
    }

    async key(type, key, code, keyCode) {
        await this.send("Input.dispatchKeyEvent", {type, key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode});
    }

    async press(key, code, keyCode) {
        await this.key("keyDown", key, code, keyCode);
        await sleep(40);
        await this.key("keyUp", key, code, keyCode);
        await sleep(60);
    }

    async screenshot(file) {
        const {data} = await this.send("Page.captureScreenshot", {format: "png"});
        writeFileSync(join(shots, file), Buffer.from(data, "base64"));
    }
}

export const KEYS = {
    up: ["ArrowUp", "ArrowUp", 38], down: ["ArrowDown", "ArrowDown", 40], left: ["ArrowLeft", "ArrowLeft", 37],
    right: ["ArrowRight", "ArrowRight", 39], enter: ["Enter", "Enter", 13], space: [" ", "Space", 32],
    w: ["w", "KeyW", 87], a: ["a", "KeyA", 65], s: ["s", "KeyS", 83], d: ["d", "KeyD", 68], e: ["e", "KeyE", 69],
};


export async function waitForGame(page) {
    for (let i = 0; i < 100; i++) {
        await sleep(200);
        if (await page.eval(`typeof knightKnightOnline === "object"`).catch(() => false)) {
            return;
        }
    }
    throw new Error(page.name + "'s game never loaded");
}
