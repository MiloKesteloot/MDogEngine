// Sound effects, made on the fly with the browser's Web Audio API (no sound files).
// Browsers only allow sound after the player presses something, so nothing plays until the first key.

const MUTED_KEY = "knight-knight-muted";
const OLD_MUTED_KEY = "sir-james-muted"; // what the game used to be called
const VOLUME = 0.25;
const DUCKED = 0.25; // how loud it is while paused

class Sound {
    constructor() {
        this.context = null;
        this.master = null;
        this.noiseBuffer = null;

        this.muted = false;
        this.ducked = false;
        try {
            this.muted = (localStorage.getItem(MUTED_KEY) ?? localStorage.getItem(OLD_MUTED_KEY)) === "true";
        } catch (e) {
            // Storage can be blocked, sound just starts on
        }

        const start = () => this.start();
        window.addEventListener("keydown", start);
        window.addEventListener("pointerdown", start);
    }

    start() {
        if (this.context === null) {
            const AudioContext = window.AudioContext ?? window.webkitAudioContext;
            if (AudioContext === undefined) {
                return;
            }
            this.context = new AudioContext();
            this.master = this.context.createGain();
            this.master.gain.value = this.muted ? 0 : this.ducked ? VOLUME * DUCKED : VOLUME;
            this.master.connect(this.context.destination);

            // One second of white noise, reused by every noisy sound
            const length = this.context.sampleRate;
            this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        }
        if (this.context.state === "suspended") {
            this.context.resume();
        }
    }

    // Quieter while the game's paused (which it is whenever the window isn't focused)
    setDucked(ducked) {
        this.ducked = ducked;
        this.updateVolume();
    }

    updateVolume() {
        if (this.master !== null) {
            const volume = this.muted ? 0 : this.ducked ? VOLUME * DUCKED : VOLUME;
            this.master.gain.setTargetAtTime(volume, this.context.currentTime, 0.1);
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        try {
            localStorage.setItem(MUTED_KEY, "" + this.muted);
        } catch (e) {
            // Still mutes, just isn't remembered
        }
        this.updateVolume();
    }

    isReady() {
        return this.context !== null && this.context.state === "running";
    }

    // A burst of noise through a filter that slides from one frequency to another
    noise(duration, filterType, fromFrequency, toFrequency, volume, delay) {
        if (!this.isReady()) return;
        const now = this.context.currentTime + (delay ?? 0);

        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = this.context.createBiquadFilter();
        filter.type = filterType;
        filter.Q.value = 1.5;
        filter.frequency.setValueAtTime(fromFrequency, now);
        filter.frequency.exponentialRampToValueAtTime(toFrequency, now + duration);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        source.connect(filter).connect(gain).connect(this.master);
        source.start(now, Math.random() * 0.5);
        source.stop(now + duration);
    }

    // A note that slides from one pitch to another and fades out
    tone(duration, wave, fromFrequency, toFrequency, volume, delay) {
        if (!this.isReady()) return;
        const now = this.context.currentTime + (delay ?? 0);

        const oscillator = this.context.createOscillator();
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(fromFrequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(toFrequency, now + duration);

        const gain = this.context.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        oscillator.connect(gain).connect(this.master);
        oscillator.start(now);
        oscillator.stop(now + duration);
    }

    // ---------- Weather ambience ----------

    // A steady loop of filtered noise for the weather: "rain", "wind", or null for quiet
    setAmbience(kind) {
        this.wantedAmbience = kind;
        if (!this.isReady() || this.ambienceKind === kind) {
            return;
        }
        if (this.ambience) {
            // Fades out the old one
            const old = this.ambience;
            old.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.3);
            setTimeout(() => old.source.stop(), 1500);
            this.ambience = null;
        }
        this.ambienceKind = kind;
        if (kind !== "rain" && kind !== "wind") {
            return;
        }

        const now = this.context.currentTime;
        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;
        source.loop = true;
        const filter = this.context.createBiquadFilter();
        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0, now);
        if (kind === "rain") {
            filter.type = "bandpass";
            filter.frequency.value = 2500;
            filter.Q.value = 0.4;
            gain.gain.setTargetAtTime(0.18, now, 0.5);
        } else {
            // Wind howls up and down: a slow wobble on the filter
            filter.type = "lowpass";
            filter.frequency.value = 500;
            filter.Q.value = 6;
            const wobble = this.context.createOscillator();
            const wobbleSize = this.context.createGain();
            wobble.frequency.value = 0.15;
            wobbleSize.gain.value = 300;
            wobble.connect(wobbleSize).connect(filter.frequency);
            wobble.start(now);
            source.addEventListener("ended", () => wobble.stop());
            gain.gain.setTargetAtTime(0.35, now, 0.5);
        }
        source.connect(filter).connect(gain).connect(this.master);
        source.start(now);
        this.ambience = {source, gain};
    }

    // Called every tick, so the weather sound starts once the browser allows sound
    update() {
        if (this.wantedAmbience !== undefined && this.ambienceKind !== this.wantedAmbience) {
            this.setAmbience(this.wantedAmbience);
        }
    }

    // ---------- Sound effects ----------

    swing() {
        this.noise(0.13, "bandpass", 700, 2600, 0.5);
    }

    // A sword swishing through tall grass
    grassCut() {
        this.noise(0.12, "bandpass", 5000, 2200, 0.35);
        this.noise(0.08, "highpass", 6000, 4000, 0.2, 0.04);
    }

    // A soft step. Crunchier on snow.
    step(snow) {
        if (snow) {
            this.noise(0.06, "bandpass", 2500, 1500, 0.12);
        } else {
            this.noise(0.04, "lowpass", 700, 300, 0.08);
        }
    }

    gunshot() {
        this.noise(0.04, "highpass", 3000, 1500, 1);
        this.noise(0.5, "lowpass", 2500, 100, 1);
        this.tone(0.2, "square", 220, 50, 0.2);
    }

    // A bullet hitting a rock
    ricochet() {
        this.tone(0.25, "sine", 2400, 900, 0.15);
        this.noise(0.04, "highpass", 3000, 4000, 0.4);
    }

    // A bullet bounced back by a sword
    reflect() {
        this.tone(0.2, "square", 1800, 2600, 0.1);
        this.noise(0.05, "highpass", 4000, 6000, 0.5);
    }

    throwSword() {
        this.noise(0.25, "bandpass", 3000, 600, 0.7);
    }

    // A thrown sword sticking into the ground
    thunk() {
        this.tone(0.12, "triangle", 300, 120, 0.3);
        this.noise(0.06, "lowpass", 1500, 400, 0.5);
    }

    // Picking a sword back up
    shing() {
        this.tone(0.3, "sine", 1800, 3200, 0.12);
        this.tone(0.3, "sine", 2700, 4200, 0.06, 0.03);
    }

    // Trying to swing without a sword
    noSword() {
        this.tone(0.1, "square", 140, 110, 0.1);
    }

    splash() {
        this.noise(0.4, "bandpass", 1800, 500, 0.8);
        this.noise(0.2, "highpass", 3000, 2000, 0.3, 0.05);
    }

    sizzle() {
        this.noise(0.6, "highpass", 4000, 7000, 0.4);
        this.noise(0.3, "lowpass", 600, 200, 0.4);
    }

    // The ground cracking before a hole opens
    crack() {
        this.noise(0.12, "bandpass", 1200, 400, 0.5);
        this.noise(0.1, "bandpass", 900, 300, 0.4, 0.15);
    }

    // Falling into a hole: a whistle going down
    fall() {
        this.tone(0.6, "sine", 900, 200, 0.12);
    }

    // One hoof hitting the ground
    hoof() {
        this.tone(0.05, "triangle", 260, 180, 0.18);
        this.noise(0.03, "lowpass", 1200, 500, 0.3);
    }

    neigh() {
        // A wobbly slide up and down
        if (!this.isReady()) return;
        const now = this.context.currentTime;
        const oscillator = this.context.createOscillator();
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(500, now);
        oscillator.frequency.linearRampToValueAtTime(900, now + 0.15);
        oscillator.frequency.linearRampToValueAtTime(600, now + 0.6);
        const wobble = this.context.createOscillator();
        const wobbleSize = this.context.createGain();
        wobble.frequency.value = 22;
        wobbleSize.gain.value = 60;
        wobble.connect(wobbleSize).connect(oscillator.frequency);
        const filter = this.context.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1100;
        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        oscillator.connect(filter).connect(gain).connect(this.master);
        oscillator.start(now);
        wobble.start(now);
        oscillator.stop(now + 0.65);
        wobble.stop(now + 0.65);
    }

    // Something big coming down out of the sky
    incoming() {
        this.noise(1.1, "bandpass", 3000, 400, 0.3);
    }

    // It landed
    impact() {
        this.noise(0.6, "lowpass", 1500, 60, 1);
        this.tone(0.4, "sine", 110, 35, 0.5);
    }

    reverse() {
        [0, 0.08, 0.16].forEach((delay, i) => this.tone(0.1, "square", i % 2 ? 500 : 700, i % 2 ? 700 : 500, 0.08, delay));
    }

    // A barrel blowing up: a big boom with a long rumble
    explosion() {
        this.noise(0.06, "highpass", 2000, 800, 1);
        this.noise(1.4, "lowpass", 2600, 40, 1);
        this.tone(1, "sine", 80, 25, 0.7);
    }

    cluck() {
        this.tone(0.06, "square", 700, 500, 0.06);
        this.tone(0.06, "square", 800, 600, 0.05, 0.09);
    }

    bawk() {
        this.tone(0.3, "sawtooth", 600, 1100, 0.08);
        this.noise(0.15, "bandpass", 1500, 2500, 0.3);
    }

    roar() {
        this.tone(0.9, "sawtooth", 140, 70, 0.2);
        this.noise(0.9, "lowpass", 900, 200, 0.6);
    }

    // The dragon flying over
    dragon() {
        this.tone(1.2, "sawtooth", 220, 90, 0.15);
        this.noise(1.6, "bandpass", 600, 200, 0.5);
    }

    flames() {
        this.noise(0.5, "bandpass", 900, 2500, 0.35);
    }

    creak() {
        this.tone(0.25, "triangle", 180, 140, 0.12);
    }

    // A hand grabbing an ankle
    grab() {
        this.noise(0.2, "lowpass", 500, 200, 0.6);
        this.tone(0.3, "sine", 300, 150, 0.1);
    }

    // A teasing "nyah nyah"
    taunt() {
        this.tone(0.14, "square", 660, 620, 0.08);
        this.tone(0.2, "square", 523, 500, 0.08, 0.16);
    }

    // A crowd cheering when someone scores
    cheer() {
        if (!this.isReady()) return;
        const now = this.context.currentTime;
        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;
        const filter = this.context.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1400;
        filter.Q.value = 0.8;
        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.3, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
        source.connect(filter).connect(gain).connect(this.master);
        source.start(now, Math.random() * 0.3);
        source.stop(now + 1.4);
    }

    // Swords hitting each other
    clang() {
        this.tone(0.35, "square", 1480, 1400, 0.12);
        this.tone(0.3, "triangle", 2210, 2150, 0.2);
        this.noise(0.05, "highpass", 3000, 5000, 0.6);
    }

    // A sword hitting a boulder
    tink() {
        this.tone(0.18, "square", 980, 900, 0.12);
        this.noise(0.05, "highpass", 2500, 4000, 0.5);
    }

    hit() {
        this.noise(0.25, "lowpass", 2400, 200, 1);
        this.tone(0.25, "square", 160, 40, 0.25);
    }

    crumble() {
        this.noise(0.35, "lowpass", 900, 120, 0.9);
        this.noise(0.2, "lowpass", 600, 100, 0.6, 0.08);
    }

    // A boulder is about to roll in. Giant ones rumble deeper and longer.
    rumble(giant) {
        if (giant) {
            this.noise(1.1, "lowpass", 160, 50, 1);
            this.tone(1, "sine", 55, 35, 0.4);
        } else {
            this.noise(0.6, "lowpass", 220, 90, 0.9);
        }
    }

    pickup() {
        [660, 880, 1320].forEach((frequency, i) => this.tone(0.12, "triangle", frequency, frequency, 0.18, i * 0.05));
    }

    // A shield bubble popping
    shatter() {
        this.noise(0.3, "highpass", 6000, 2000, 0.6);
        this.tone(0.3, "triangle", 1800, 600, 0.15);
    }

    // A big hit: a deep boom under the normal one
    finalHit() {
        this.tone(0.6, "sine", 90, 30, 0.6);
        this.noise(0.5, "lowpass", 1200, 80, 0.8, 0.02);
    }

    // A lightning strike
    thunder() {
        this.noise(0.08, "highpass", 4000, 2000, 1);
        this.noise(0.9, "lowpass", 1800, 60, 1, 0.03);
        this.tone(0.7, "sine", 70, 30, 0.5, 0.03);
    }

    // Lightning about to strike: a rising crackle
    charge() {
        this.tone(0.7, "sawtooth", 200, 1200, 0.05);
    }

    grow() {
        this.tone(0.45, "square", 150, 600, 0.12);
    }

    shrink() {
        this.tone(0.35, "square", 600, 150, 0.1);
    }

    fury() {
        this.tone(0.4, "sawtooth", 110, 80, 0.2);
        this.noise(0.4, "bandpass", 300, 1200, 0.5);
    }

    menuMove() {
        this.tone(0.05, "square", 660, 660, 0.06);
    }

    menuSelect() {
        this.tone(0.08, "square", 990, 1320, 0.07);
    }

    ready() {
        this.tone(0.12, "square", 440, 440, 0.1);
    }

    fight() {
        this.tone(0.25, "square", 880, 880, 0.12);
    }

    roundWin() {
        [523, 659, 784].forEach((frequency, i) => this.tone(0.15, "square", frequency, frequency, 0.08, i * 0.09));
    }

    matchWin() {
        [523, 659, 784, 1047, 784, 1047].forEach((frequency, i) => {
            const length = i === 5 ? 0.5 : 0.14;
            this.tone(length, "square", frequency, frequency, 0.08, i * 0.12);
        });
    }
}

export default Sound;
