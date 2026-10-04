/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   Snack Man Remastered - sound effects                               ║
 * ║   This file was written by Claude (Anthropic's AI).                  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// Pac-Man style sound effects, made on the fly with the browser's Web Audio API (no sound files).
// Browsers only allow sound after the player presses something, so nothing plays until the first key or touch.
//
// The Pac-Man sounds (waka, siren, frightened siren, eating a ghost, dying) come from a small copy of the
// arcade's sound chip, the Namco WSG. It plays one of eight tiny 4-bit waveforms, and the game changes the
// pitch and volume 60 times a second. The waveforms and per-frame values here are the arcade's, as worked
// out by Andre Weissflog's pacman.c (https://github.com/floooh/pacman.c).

const MUTED_KEY = "snack-man-muted";
const VOLUME = 0.09;

// ---------- The arcade sound chip ----------

const WSG_CLOCK = 96000; // the chip adds the frequency to a 20-bit counter this many times a second
const WSG_FRAME_RATE = 60; // the game updated the chip once per video frame

// Eight waveforms of 32 4-bit samples each, from the arcade's sound ROM
const WAVETABLE = [
    0x7, 0x9, 0xa, 0xb, 0xc, 0xd, 0xd, 0xe, 0xe, 0xe, 0xd, 0xd, 0xc, 0xb, 0xa, 0x9,
    0x7, 0x5, 0x4, 0x3, 0x2, 0x1, 0x1, 0x0, 0x0, 0x0, 0x1, 0x1, 0x2, 0x3, 0x4, 0x5,
    0x7, 0xc, 0xe, 0xe, 0xd, 0xb, 0x9, 0xa, 0xb, 0xb, 0xa, 0x9, 0x6, 0x4, 0x3, 0x5,
    0x7, 0x9, 0xb, 0xa, 0x8, 0x5, 0x4, 0x3, 0x3, 0x4, 0x5, 0x3, 0x1, 0x0, 0x0, 0x2,
    0x7, 0xa, 0xc, 0xd, 0xe, 0xd, 0xc, 0xa, 0x7, 0x4, 0x2, 0x1, 0x0, 0x1, 0x2, 0x4,
    0x7, 0xb, 0xd, 0xe, 0xd, 0xb, 0x7, 0x3, 0x1, 0x0, 0x1, 0x3, 0x7, 0xe, 0x7, 0x0,
    0x7, 0xd, 0xb, 0x8, 0xb, 0xd, 0x9, 0x6, 0xb, 0xe, 0xc, 0x7, 0x9, 0xa, 0x6, 0x2,
    0x7, 0xc, 0x8, 0x4, 0x5, 0x7, 0x2, 0x0, 0x3, 0x8, 0x5, 0x1, 0x3, 0x6, 0x3, 0x1,
    0x0, 0x8, 0xf, 0x7, 0x1, 0x8, 0xe, 0x7, 0x2, 0x8, 0xd, 0x7, 0x3, 0x8, 0xc, 0x7,
    0x4, 0x8, 0xb, 0x7, 0x5, 0x8, 0xa, 0x7, 0x6, 0x8, 0x9, 0x7, 0x7, 0x8, 0x8, 0x7,
    0x7, 0x8, 0x6, 0x9, 0x5, 0xa, 0x4, 0xb, 0x3, 0xc, 0x2, 0xd, 0x1, 0xe, 0x0, 0xf,
    0x0, 0xf, 0x1, 0xe, 0x2, 0xd, 0x3, 0xc, 0x4, 0xb, 0x5, 0xa, 0x6, 0x9, 0x7, 0x8,
    0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf,
    0xf, 0xe, 0xd, 0xc, 0xb, 0xa, 0x9, 0x8, 0x7, 0x6, 0x5, 0x4, 0x3, 0x2, 0x1, 0x0,
    0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf,
    0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf
];

// A sound is a list of frames (one per 1/60 second), each {frequency, waveform, volume}. The frequency is
// the chip's register value: frequency * 96000 / 2^20 gives Hz, so 0x1000 is about 375 Hz.

// A steady slide: the frequency changes by the same step every frame
function sweep(waveform, volume, start, step, frames) {
    const result = [];
    for (let i = 0; i < frames; i++) {
        result.push({frequency: start + step * i, waveform, volume});
    }
    return result;
}

// Each pellet plays one of these, alternating: "wa" slides down, "ka" slides back up
const EAT_DOT_1 = sweep(2, 12, 0x1500, -0x300, 5);
const EAT_DOT_2 = sweep(2, 12, 0x0700, 0x300, 5);

// Eating a ghost: a long, low rising "bwoop"
const EAT_GHOST = sweep(5, 12, 0, 0x20, 32);

// The frightened-ghost siren, looped: eight quick rising slides a second
const FRIGHTENED = sweep(4, 10, 0x180, 0x180, 8);

// The background siren, looped: up for 12 frames, back down for 12. The arcade's siren gets higher as the
// board empties. The exact steps of the later sirens weren't documented, so each stage here just starts
// a little higher.
const SIREN_STAGES = 4;
function siren(stage) {
    const start = 0x1000 + stage * 0x180;
    return sweep(6, 6, start, 0x200, 12).concat(sweep(6, 6, start + 0x1600, -0x200, 12));
}

// Pac-Man dying, as the arcade played it: falling "wee-oo"s, each one lower and quieter, then two quick
// rising pops. The arcade plays six wee-oos; here they keep going for as long as the death takes, so a long
// tail sliding back in gets an absurdly long death. frames is how long the wee-oos last.
function death(frames) {
    const result = [];
    const count = Math.max(1, Math.round(frames / 12));
    for (let i = 0; result.length < frames; i++) {
        // Like the arcade, from 0x1F00 down to 0x1500 and from volume 15 down to 10, just spread out
        const t = Math.min(1, i / Math.max(1, count - 1));
        const start = 0x1F00 - Math.round(t * 0x0A) * 0x100;
        const volume = Math.round(15 - 5 * t);
        result.push(...sweep(1, volume, start, -0x100, 6), ...sweep(1, volume, start - 0x400, 0x100, 6));
    }
    result.length = frames;
    const pop = sweep(1, 8, 0x800, 0x800, 11);
    return result.concat(pop, [{frequency: 0, waveform: 0, volume: 0}], pop);
}

class Sound {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.buffers = new Map(); // rendered chip sounds, by name
        // Like the arcade chip, a voice plays one sound at a time, and a new one cuts off the old one.
        // Voice 1 plays the looping sirens, voice 2 the waka, eating a ghost and dying.
        this.voices = [null, null, null];
        this.background = null; // name of the siren playing on voice 1
        this.paused = false;
        this.waka = false; // alternates the two halves of the "waka" chomp

        try {
            this.muted = localStorage.getItem(MUTED_KEY) === "true";
        } catch (e) {
            this.muted = false;
        }

        const unlock = () => this.unlock();
        window.addEventListener("keydown", unlock);
        window.addEventListener("touchstart", unlock);
        window.addEventListener("pointerdown", unlock);
    }

    unlock() {
        if (this.ctx === null) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                return;
            }
            this.ctx = new AudioContext();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.muted ? 0 : VOLUME;
            this.master.connect(this.ctx.destination);

            // A second of white noise, for crunches
            const length = this.ctx.sampleRate;
            this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
            const data = this.noise.getChannelData(0);
            for (let i = 0; i < length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        }
        if (this.ctx.state === "suspended" && !this.paused) {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        try {
            localStorage.setItem(MUTED_KEY, "" + this.muted);
        } catch (e) {
            // No storage: the setting just won't stick around
        }
        if (this.master !== null) {
            this.master.gain.value = this.muted ? 0 : VOLUME;
        }
    }

    // Freezes every sound (including ones already playing) while the game is paused
    setPaused(paused) {
        this.paused = paused;
        if (this.ctx === null) {
            return;
        }
        if (paused) {
            this.ctx.suspend();
        } else {
            this.ctx.resume();
        }
    }

    ready() {
        return this.ctx !== null && this.ctx.state === "running";
    }

    // ----- The chip -----

    // Runs the chip over a list of frames and records what it would have played. Like the real thing,
    // the chip is stepped 96000 times a second, and those steps are averaged down to the output rate.
    render(frames) {
        const rate = this.ctx.sampleRate;
        const length = Math.ceil(frames.length / WSG_FRAME_RATE * rate);
        const buffer = this.ctx.createBuffer(1, length, rate);
        const data = buffer.getChannelData(0);
        const stepsPerSample = WSG_CLOCK / rate;
        let counter = 0;
        let steps = 0;
        let last = 0;
        for (let i = 0; i < length; i++) {
            const frame = frames[Math.min(frames.length - 1, Math.floor(i * WSG_FRAME_RATE / rate))];
            const base = frame.waveform * 32;
            let total = 0;
            let count = 0;
            for (steps += stepsPerSample; steps >= 1; steps -= 1) {
                counter = (counter + frame.frequency) & 0xFFFFF;
                total += (WAVETABLE[base + (counter >>> 15)] - 8) * frame.volume;
                count += 1;
            }
            if (count > 0) {
                last = total / (count * 128);
            }
            data[i] = last;
        }
        return buffer;
    }

    // Plays a chip sound on a voice, cutting off whatever that voice was playing
    play(voice, name, frames, loop) {
        this.stopVoice(voice);
        if (!this.ready()) {
            return;
        }
        let buffer = this.buffers.get(name);
        if (buffer === undefined) {
            buffer = this.render(frames);
            this.buffers.set(name, buffer);
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        source.connect(this.master);
        source.start();
        this.voices[voice] = source;
    }

    stopVoice(voice) {
        if (this.voices[voice] !== null) {
            this.voices[voice].stop();
            this.voices[voice] = null;
        }
    }

    // One oscillator note, sliding from one pitch to another
    tone(type, from, to, duration, volume, delay) {
        if (!this.ready()) {
            return;
        }
        const start = this.ctx.currentTime + (delay ?? 0);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, start);
        osc.frequency.exponentialRampToValueAtTime(to, start + duration);
        gain.gain.setValueAtTime(volume, start);
        gain.gain.setValueAtTime(volume, start + duration * 0.8);
        gain.gain.linearRampToValueAtTime(0, start + duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(start);
        osc.stop(start + duration + 0.02);
    }

    // ----- Effects -----

    // Pac-Man's "waka waka": each pellet plays one half
    chomp() {
        this.waka = !this.waka;
        if (this.waka) {
            this.play(2, "eatDot1", EAT_DOT_1, false);
        } else {
            this.play(2, "eatDot2", EAT_DOT_2, false);
        }
    }

    // What plays underneath everything: "siren" is Pac-Man's background "wooo-eeee", which climbs as the
    // board empties (progress is the fraction of pellets eaten, from 0 to 1). "frightened" is the
    // "wuu wuu wuu" while he's blue. null is silence.
    setBackground(mode, progress) {
        let name = null;
        let frames = null;
        if (mode === "siren") {
            const stage = Math.min(SIREN_STAGES - 1, Math.floor(progress * SIREN_STAGES));
            name = "siren" + stage;
            frames = siren(stage);
        } else if (mode === "frightened") {
            name = "frightened";
            frames = FRIGHTENED;
        }

        // Before the first key press there's no sound at all, so don't remember a siren that never started
        if (name === this.background || (name !== null && !this.ready())) {
            return;
        }
        this.background = name;
        if (name === null) {
            this.stopVoice(1);
        } else {
            this.play(1, name, frames, true);
        }
    }

    // Pac-Man eating a ghost
    bonus() {
        this.play(2, "eatGhost", EAT_GHOST, false);
    }

    // Biting through himself: a crunch and a drop
    bite() {
        if (!this.ready()) {
            return;
        }
        const start = this.ctx.currentTime;
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        source.buffer = this.noise;
        gain.gain.setValueAtTime(1, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.12);
        source.connect(gain);
        gain.connect(this.master);
        source.start(start);
        source.stop(start + 0.13);
        this.tone("square", 520, 70, 0.2, 0.5);
    }

    // A bitten-off segment popping
    pop() {
        this.tone("square", 1100, 500, 0.035, 0.08);
    }

    // Pac-Man's death. seconds is how long the wee-oos go on before the two pops.
    death(seconds) {
        this.setBackground(null);
        const frames = Math.max(1, Math.round(seconds * WSG_FRAME_RATE));
        this.play(2, "death" + frames, death(frames), false);
    }

    // Cuts off anything still playing, like a long death sound when the game restarts
    stopAll() {
        this.setBackground(null);
        this.stopVoice(2);
    }

    // A short tune when a game starts (not Pac-Man's; that one's copyrighted music)
    start() {
        const notes = [523, 659, 784, 659, 698, 880, 784, 0, 1047];
        notes.forEach((note, i) => {
            if (note > 0) {
                this.tone("square", note, note * 0.995, 0.1, 0.1, i * 0.11);
            }
        });
    }

    // Board cleared
    levelClear() {
        const notes = [523, 659, 784, 1047, 784, 1047];
        notes.forEach((note, i) => this.tone("triangle", note, note, 0.12, 0.45, i * 0.09));
    }
}

export default Sound;
