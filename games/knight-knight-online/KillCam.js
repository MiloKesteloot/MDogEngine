import MDog from "../../MDogModules/MDogMain.js"

// The kill cam: keeps the last couple of seconds of what was on screen, so the winning blow can be played back
// in slow motion. It copies the finished picture each frame, so it doesn't need to know how anything was drawn.
// Without a page to make canvases on (like in tests) it just never has anything to play.

const CAPTURE_EVERY = 4; // ticks between saved pictures (40 a second)
const KEEP_TICKS = 2.4 * 160; // how far back it remembers
export const BEFORE_TICKS = 150; // how much of what led up to the blow is played...
export const AFTER_TICKS = 140; // ...and of what came after it
export const PLAYBACK_SPEED = 0.45; // slower than it really happened

class KillCam {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.available = typeof document !== "undefined";
        this.frames = []; // {tick, canvas}, oldest first
        this.spare = []; // canvases that aren't needed any more, to reuse
        this.lastCapture = -Infinity;
        this.playing = false;
    }

    clear() {
        this.spare.push(...this.frames.map(frame => frame.canvas));
        this.frames = [];
        this.playing = false;
        // Online the replay's clock starts again from 0 with each match, so the last picture's time has to go too, or
        // nothing would be saved until the new clock caught up with the old one
        this.lastCapture = -Infinity;
    }

    // Saves what's on the screen now. tick counts every tick of the game, paused or not.
    capture(tick) {
        if (!this.available || this.playing || tick - this.lastCapture < CAPTURE_EVERY) {
            return;
        }
        this.lastCapture = tick;
        const canvas = this.spare.pop() ?? this.makeCanvas();
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.drawImage(MDog.Draw._getDrawingBoard(0).element, 0, 0);
        this.frames.push({tick, canvas});
        while (this.frames.length > 0 && this.frames[0].tick < tick - KEEP_TICKS) {
            this.spare.push(this.frames.shift().canvas);
        }
    }

    makeCanvas() {
        const canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        return canvas;
    }

    // Can it play back a blow that happened at this tick, once the frames after it are saved?
    isReady(blowTick, tick) {
        return this.available && tick >= blowTick + AFTER_TICKS && this.frames.length > 10;
    }

    // Online, the game itself keeps time for the replay (so it's the same length for both players), and this just
    // shows the picture for how far through it is (0 to 1)
    show(blowTick, progress) {
        this.from = blowTick - BEFORE_TICKS;
        this.to = blowTick + AFTER_TICKS;
        this.position = this.from + (this.to - this.from) * progress;
    }

    start(blowTick) {
        this.from = blowTick - BEFORE_TICKS;
        this.to = blowTick + AFTER_TICKS;
        this.position = Math.max(this.from, this.frames[0].tick);
        this.playing = true;
    }

    update() {
        this.position += PLAYBACK_SPEED;
        if (this.position > this.to) {
            this.playing = false;
        }
    }

    stop() {
        this.playing = false;
    }

    // How far through the replay it is, from 0 to 1
    getProgress() {
        return (this.position - this.from) / (this.to - this.from);
    }

    draw() {
        // The last picture saved at or before where the replay is up to
        let frame = this.frames[0];
        for (const candidate of this.frames) {
            if (candidate.tick <= this.position) {
                frame = candidate;
            }
        }
        if (frame !== undefined) {
            MDog.Draw._rawImage(frame.canvas, 0, 0, this.width, this.height);
        }
    }
}

export default KillCam;
