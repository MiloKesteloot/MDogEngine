/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   Snack Man Remastered - sound effects                               ║
 * ║   This file was written by Claude (Anthropic's AI).                  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// Pac-Man style sound effects, made on the fly with the browser's Web Audio API (no sound files).
// Browsers only allow sound after the player presses something, so nothing plays until the first key or touch.

const MUTED_KEY = "snack-man-muted";
const VOLUME = 0.22;

class Sound {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.siren = null;
        this.drone = null;
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

            // Pac-Man's sound chip played short, low-resolution waveforms, which sound buzzier than a clean
            // triangle. A handful of falling harmonics gets close to that.
            const harmonics = [0, 1, 0.6, 0.35, 0.22, 0.12, 0.07];
            this.arcadeWave = this.ctx.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics));
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

    // Pac-Man's "waka waka": each pellet plays one half, "wa" sliding down and "ka" sliding back up. Each half
    // lasts as long as it takes to reach the next pellet, so a row of pellets makes one unbroken waka.
    // The pitch moves in steps 60 times a second, like the arcade's sound chip, which gives it its grit.
    chomp(duration) {
        if (!this.ready()) {
            return;
        }
        this.waka = !this.waka;
        const high = 620;
        const low = 170;
        const from = this.waka ? high : low;
        const to = this.waka ? low : high;

        const start = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.setPeriodicWave(this.arcadeWave);
        const steps = Math.max(4, Math.round(duration * 60));
        for (let i = 0; i < steps; i++) {
            const pitch = from * Math.pow(to / from, i / (steps - 1));
            osc.frequency.setValueAtTime(pitch, start + duration * i / steps);
        }
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.3, start + 0.005);
        gain.gain.setValueAtTime(0.3, start + duration - 0.01);
        gain.gain.linearRampToValueAtTime(0, start + duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(start);
        osc.stop(start + duration + 0.02);
    }

    // Pac-Man's background siren: a "wooo-eeee" that never stops while he's moving around, and goes up a
    // notch as the board empties. progress is the fraction of pellets eaten, from 0 to 1.
    setDrone(on, progress) {
        if (!this.ready()) {
            return;
        }
        if (this.drone === null) {
            if (!on) {
                return;
            }
            const osc = this.ctx.createOscillator();
            const lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();
            osc.setPeriodicWave(this.arcadeWave);
            lfo.type = "triangle";
            lfo.frequency.value = 2.3;
            filter.type = "lowpass";
            filter.frequency.value = 1800;
            gain.gain.value = 0;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.master);
            osc.start();
            lfo.start();
            this.drone = {osc, lfo, lfoGain, gain, stage: -1, on: false};
        }

        // Like the arcade, the pitch steps up in a few stages rather than sliding
        const stage = Math.min(3, Math.floor(progress * 4));
        if (stage !== this.drone.stage) {
            this.drone.stage = stage;
            const base = 400 * Math.pow(1.12, stage);
            const now = this.ctx.currentTime;
            this.drone.osc.frequency.setValueAtTime(base, now);
            this.drone.lfoGain.gain.setValueAtTime(base * 0.3, now);
            this.drone.lfo.frequency.setValueAtTime(2.3 + stage * 0.3, now);
        }
        if (on !== this.drone.on) {
            this.drone.on = on;
            // A quick fade instead of a hard cut, so it doesn't click
            this.drone.gain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.02);
        }
    }

    // The frightened-ghost "wuu wuu wuu" that plays the whole time he's blue
    setSiren(on) {
        if (on && this.siren === null && this.ready()) {
            const osc = this.ctx.createOscillator();
            const lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            const gain = this.ctx.createGain();
            osc.type = "square";
            osc.frequency.value = 330;
            lfo.type = "sawtooth";
            lfo.frequency.value = 7.5;
            lfoGain.gain.value = 210;
            gain.gain.value = 0.07;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            osc.connect(gain);
            gain.connect(this.master);
            osc.start();
            lfo.start();
            this.siren = {osc, lfo};
        } else if (!on && this.siren !== null) {
            this.siren.osc.stop();
            this.siren.lfo.stop();
            this.siren = null;
        }
    }

    // Like Pac-Man eating a ghost: a fast rising "whoop"
    bonus() {
        this.tone("square", 140, 1500, 0.32, 0.18);
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
        gain.gain.setValueAtTime(0.5, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.12);
        source.connect(gain);
        gain.connect(this.master);
        source.start(start);
        source.stop(start + 0.13);
        this.tone("square", 520, 70, 0.2, 0.2);
    }

    // A bitten-off segment popping
    pop() {
        this.tone("square", 1100, 500, 0.035, 0.08);
    }

    // Pac-Man's death: a run of falling "wee-oo"s, each one lower, then two pops
    death() {
        const steps = 9;
        const stepLength = 0.075;
        for (let i = 0; i < steps; i++) {
            const pitch = 900 * Math.pow(0.86, i);
            this.tone("square", pitch * 0.75, pitch, stepLength * 0.45, 0.13, i * stepLength);
            this.tone("square", pitch, pitch * 0.5, stepLength * 0.55, 0.13, i * stepLength + stepLength * 0.45);
        }
        const popsAt = steps * stepLength + 0.04;
        this.tone("square", 180, 700, 0.09, 0.15, popsAt);
        this.tone("square", 180, 700, 0.09, 0.15, popsAt + 0.14);
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
