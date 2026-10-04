/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   Snack Man Remastered - controls                                    ║
 * ║   This file was written by Claude (Anthropic's AI).                  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import MDog from "../../MDogModules/MDogMain.js"

// Keyboard and touch input for Snack Man. Call update() once per tick, before anything reads it.
// On touch screens, swipe to turn and tap to start, pause, or pick a menu item.

const KEYS = {
    up: ["ArrowUp", "w"],
    down: ["ArrowDown", "s"],
    left: ["ArrowLeft", "a"],
    right: ["ArrowRight", "d"],
    confirm: ["Enter", " ", "z"],
    pause: ["p", "Escape"],
    restart: ["r"],
    mute: ["m"]
}

const DIRECTION_NAMES = ["up", "down", "left", "right"];

const SWIPE_DISTANCE = 24; // CSS pixels a finger has to move to count as a swipe
const KEY_BUFFER_TICKS = 40; // a released turn key is remembered this long (0.25s)
const SWIPE_BUFFER_TICKS = 80; // a swipe has no "held", so it's remembered longer (0.5s)

// hold - true (the default) checks if a key is held down, false checks if it was pressed this tick
function keyDown(keySet, hold) {
    hold = hold ?? true;
    for (const key of keySet) {
        if (hold ? MDog.Input.Keyboard.isDown(key) : MDog.Input.Keyboard.isClicked(key)) {
            return true;
        }
    }
    return false;
}

class Controls {
    constructor() {
        this.swipes = []; // direction names swiped since the last update
        this.taps = 0;
        this.direction = null; // direction pressed this tick
        this.directionBuffer = 0;
        this.tapped = false;
        this.touch = null; // where the current swipe started

        // Whether the player is on a touch screen, so hints can say "tap" or "press enter". It starts as a
        // guess from the device (a finger is a "coarse" pointer), then follows whatever they actually use.
        this.touchMode = window.matchMedia !== undefined && window.matchMedia("(pointer: coarse)").matches;
        window.addEventListener("keydown", () => {
            this.touchMode = false;
        });

        // Touch events come in between ticks, so they're queued up and handed out in update()
        window.addEventListener("touchstart", e => {
            this.touchMode = true;
            const t = e.changedTouches[0];
            this.touch = {x: t.clientX, y: t.clientY, swiped: false};
        }, {passive: true});

        window.addEventListener("touchmove", e => {
            e.preventDefault(); // don't scroll or zoom the page while playing
            if (this.touch === null) {
                return;
            }
            const t = e.changedTouches[0];
            const dx = t.clientX - this.touch.x;
            const dy = t.clientY - this.touch.y;
            if (Math.hypot(dx, dy) < SWIPE_DISTANCE) {
                return;
            }
            if (Math.abs(dx) > Math.abs(dy)) {
                this.swipes.push(dx > 0 ? "right" : "left");
            } else {
                this.swipes.push(dy > 0 ? "down" : "up");
            }
            // Start measuring again from here, so one long drag can make several turns
            this.touch = {x: t.clientX, y: t.clientY, swiped: true};
        }, {passive: false});

        window.addEventListener("touchend", () => {
            if (this.touch !== null && !this.touch.swiped) {
                this.taps += 1;
            }
            this.touch = null;
        });
    }

    update() {
        this.direction = null;
        for (const name of DIRECTION_NAMES) {
            if (keyDown(KEYS[name], false)) {
                this.direction = name;
                this.directionBuffer = KEY_BUFFER_TICKS;
            }
        }
        if (this.swipes.length > 0) {
            this.direction = this.swipes.shift();
            this.directionBuffer = SWIPE_BUFFER_TICKS;
        }

        this.tapped = this.taps > 0;
        this.taps = 0;
    }

    // ----- What Snack Man reads -----

    // The direction pressed or swiped this tick, or null
    pressedDirection() {
        return this.direction;
    }

    // How long that press should be remembered if it can't be used right away
    bufferTicks() {
        return this.directionBuffer;
    }

    // Whether a direction's key is still held down (swipes never are)
    isHeld(name) {
        return keyDown(KEYS[name]);
    }

    // ----- What the game reads -----

    confirmPressed() {
        return keyDown(KEYS.confirm, false) || this.tapped;
    }

    pausePressed() {
        return keyDown(KEYS.pause, false);
    }

    restartPressed() {
        return keyDown(KEYS.restart, false);
    }

    mutePressed() {
        return keyDown(KEYS.mute, false);
    }

    tappedScreen() {
        return this.tapped;
    }

    isTouch() {
        return this.touchMode;
    }
}

export {KEY_BUFFER_TICKS};
export default Controls;
