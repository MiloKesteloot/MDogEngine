// Chiptune music, played with the browser's Web Audio API like the sound effects.
// Each song is 4 bars of 16 steps: a lead tune, a bass line and drums, looped. Notes are MIDI numbers
// (60 is middle C), and null is a rest.

const VOLUME = 0.075; // under the sound effects, so the swords cut through
const DUCKED = 0.35; // how loud it is while paused
const LOOKAHEAD = 0.15; // seconds of notes scheduled ahead of time, so they don't stutter

const _ = null;

const SONGS = {
    // The meadow and the river: a bouncy A minor tune
    battle: {
        volume: 1,
        bpm: 138,
        lead: "square",
        bass: "triangle",
        roots: [45, 41, 48, 43], // A, F, C, G
        leadNotes: [
            [69, _, 72, _, 76, _, 74, 72, 71, _, 72, _, 69, _, _, _],
            [69, _, 72, _, 77, _, 76, 74, 72, _, 69, _, _, _, 72, _],
            [76, _, 72, _, 67, _, 72, _, 76, _, 79, _, 76, 74, 72, _],
            [74, _, 71, _, 67, _, 71, _, 74, _, 76, 74, 71, _, 67, _],
        ],
        bassSteps: [0, _, _, 12, _, _, 0, _, 0, _, _, 12, _, _, 0, 7],
        drums: "rock",
    },
    // The forest at night: slower and spookier, in D minor
    night: {
        volume: 1.3,
        bpm: 104,
        lead: "triangle",
        bass: "triangle",
        roots: [38, 46, 41, 36], // D, Bb, F, C
        leadNotes: [
            [74, _, _, 77, _, _, 76, _, 74, _, _, _, 69, _, _, _],
            [70, _, _, 74, _, _, 77, _, 76, _, 74, _, _, _, _, _],
            [72, _, _, 77, _, _, 81, _, 79, _, 77, _, 76, _, _, _],
            [76, _, _, 72, _, _, 67, _, 72, _, 74, _, _, _, _, _],
        ],
        bassSteps: [0, _, _, _, 7, _, _, _, 12, _, _, _, 7, _, _, _],
        drums: "soft",
    },
    // The volcano: fast and driving
    volcano: {
        volume: 0.6, // a sawtooth tune over a square bass is a lot louder than the rest
        bpm: 156,
        lead: "sawtooth",
        bass: "square",
        roots: [40, 41, 40, 38], // E, F, E, D
        leadNotes: [
            [76, _, 76, 77, 76, _, 74, _, 76, _, 79, _, 77, 76, 74, _],
            [77, _, 77, 79, 77, _, 76, _, 72, _, 74, _, 76, _, _, _],
            [76, _, 76, 77, 76, _, 74, _, 76, _, 83, _, 81, 79, 77, _],
            [74, _, 77, _, 81, _, 79, 77, 76, _, 74, _, 71, _, _, _],
        ],
        bassSteps: [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 12, 0, 12],
        drums: "rock",
    },
    // The showdown: a twangy western tune in E minor, with a galloping bass
    showdown: {
        volume: 1,
        bpm: 116,
        lead: "square",
        bass: "triangle",
        roots: [40, 40, 45, 47], // E, E, A, B
        leadNotes: [
            [64, _, _, 67, _, _, 71, _, 76, _, _, _, 74, _, 71, _],
            [72, _, _, 71, _, _, 69, _, 67, _, 69, _, 71, _, _, _],
            [69, _, _, 72, _, _, 76, _, 74, _, 72, _, 69, _, _, _],
            [71, _, 75, _, 78, _, 75, _, 71, _, _, _, 66, _, 71, _],
        ],
        bassSteps: [0, _, 7, 0, 12, _, 7, _, 0, _, 7, 0, 12, _, 7, _],
        drums: "soft",
    },
    // The pirate ship: a rollicking shanty in D minor
    shanty: {
        volume: 1,
        bpm: 128,
        lead: "square",
        bass: "triangle",
        roots: [38, 36, 34, 33], // D, C, Bb, A
        leadNotes: [
            [74, _, 74, 74, _, 74, 77, _, 76, _, 74, _, 72, _, 69, _],
            [72, _, 72, 72, _, 72, 76, _, 74, _, 72, _, 69, _, 67, _],
            [70, _, 70, 70, _, 74, 77, _, 79, _, 77, _, 74, _, 70, _],
            [69, _, 73, _, 76, _, 73, _, 69, _, 71, _, 73, _, _, _],
        ],
        bassSteps: [0, _, _, 7, _, _, 12, _, 0, _, _, 7, _, _, 12, _],
        drums: "rock",
    },
    // The snowfield: light and twinkly, in G major
    snow: {
        volume: 1.2,
        bpm: 120,
        lead: "sine",
        bass: "triangle",
        roots: [43, 40, 36, 38], // G, E, C, D
        leadNotes: [
            [79, _, 83, _, 86, _, 83, _, 81, _, 79, _, 76, _, _, _],
            [79, _, 76, _, 71, _, 76, _, 79, _, 83, _, 81, _, _, _],
            [76, _, 79, _, 84, _, 83, _, 79, _, 76, _, 72, _, 74, _],
            [74, _, 78, _, 81, _, 78, _, 74, _, 78, _, 81, _, _, _],
        ],
        bassSteps: [0, _, _, _, 7, _, _, _, 0, _, _, _, 7, _, 12, _],
        drums: "soft",
    },
};

function midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

class Music {
    constructor(sound) {
        this.sound = sound; // shares its audio context
        this.output = null;
        this.song = null;
        this.enabled = true;
        this.intense = false; // match point: faster, with busier drums
        this.ducked = false;
        this.step = 0;
        this.nextStepTime = 0;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        this.updateVolume();
    }

    setSong(name) {
        if (this.songName === name) {
            return;
        }
        this.songName = name;
        this.song = name === null ? null : SONGS[name];
        this.step = 0;
        this.nextStepTime = 0;
        this.updateVolume();
    }

    setIntense(intense) {
        this.intense = intense;
    }

    setDucked(ducked) {
        this.ducked = ducked;
        this.updateVolume();
    }

    updateVolume() {
        if (this.output !== null) {
            const full = VOLUME * (this.song?.volume ?? 1);
            const volume = !this.enabled ? 0 : this.ducked ? full * DUCKED : full;
            this.output.gain.setTargetAtTime(volume, this.sound.context.currentTime, 0.1);
        }
    }

    // Called every tick: schedules whatever notes are coming up
    update() {
        if (!this.sound.isReady() || this.song === null) {
            return;
        }
        const context = this.sound.context;
        if (this.output === null) {
            // Music isn't affected by muting the sound effects, it has its own setting
            this.output = context.createGain();
            this.output.connect(context.destination);
            this.output.gain.value = 0;
            this.updateVolume();
        }
        if (this.nextStepTime < context.currentTime) {
            this.nextStepTime = context.currentTime + 0.05;
        }
        const stepLength = 60 / (this.song.bpm * (this.intense ? 1.12 : 1)) / 4;
        while (this.nextStepTime < context.currentTime + LOOKAHEAD) {
            this.playStep(this.step, this.nextStepTime, stepLength);
            this.step = (this.step + 1) % 64;
            this.nextStepTime += stepLength;
        }
    }

    playStep(step, time, stepLength) {
        const song = this.song;
        const bar = Math.floor(step / 16);
        const beat = step % 16;

        const lead = song.leadNotes[bar][beat];
        if (lead !== null) {
            // Held until the next note
            let length = 1;
            while (beat + length < 16 && song.leadNotes[bar][beat + length] === null && length < 4) {
                length++;
            }
            this.note(song.lead, midiToFrequency(lead), time, stepLength * length * 0.9, 0.22);
        }

        const bass = song.bassSteps[beat];
        if (bass !== null) {
            this.note(song.bass, midiToFrequency(song.roots[bar] + bass), time, stepLength * 0.9, 0.45);
        }

        this.drums(song.drums, beat, time);
    }

    drums(style, beat, time) {
        const kick = style === "rock" ? beat % 8 === 0 || (beat === 10) : beat === 0 || beat === 8;
        const snare = beat === 4 || beat === 12;
        const hat = this.intense ? true : beat % 2 === 0;
        if (kick) {
            this.kick(time);
        }
        if (snare) {
            this.hit(time, "bandpass", 1800, 0.12, style === "rock" ? 0.5 : 0.25);
        }
        if (hat) {
            this.hit(time, "highpass", 7000, 0.03, style === "rock" ? 0.18 : 0.1);
        }
    }

    note(wave, frequency, time, length, volume) {
        const context = this.sound.context;
        const oscillator = context.createOscillator();
        oscillator.type = wave;
        oscillator.frequency.value = frequency;
        const gain = context.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.setTargetAtTime(volume * 0.6, time + 0.02, 0.05);
        gain.gain.setTargetAtTime(0, time + length, 0.02);
        oscillator.connect(gain).connect(this.output);
        oscillator.start(time);
        oscillator.stop(time + length + 0.1);
    }

    kick(time) {
        const context = this.sound.context;
        const oscillator = context.createOscillator();
        oscillator.frequency.setValueAtTime(150, time);
        oscillator.frequency.exponentialRampToValueAtTime(40, time + 0.12);
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.9, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        oscillator.connect(gain).connect(this.output);
        oscillator.start(time);
        oscillator.stop(time + 0.16);
    }

    // A burst of filtered noise, for snares and hi-hats
    hit(time, type, frequency, length, volume) {
        const context = this.sound.context;
        const source = context.createBufferSource();
        source.buffer = this.sound.noiseBuffer;
        const filter = context.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        const gain = context.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + length);
        source.connect(filter).connect(gain).connect(this.output);
        source.start(time, Math.random() * 0.5);
        source.stop(time + length);
    }
}

export default Music;
