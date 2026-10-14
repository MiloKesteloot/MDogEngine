import MDog from "../../MDogModules/MDogMain.js"
import {dsin} from "./DetMath.js";

// The weather for one round: what falls from the sky, and how it pushes things around.
//   clear, rain (slows boulders), wind (pushes knights and boulders one way), snow, ash

function random(min, max) {
    return min + Math.random() * (max - min);
}

const LABELS = {clear: null, rain: "RAIN", wind: "WINDY", snow: "SNOWING", ash: "ASH FALL"};

class Weather {
    // windScale makes the wind weaker (on ice, where it'd push you around a lot). gameRandom is the game's own random
    // numbers, for the one thing here that changes what happens (which way the wind blows). The raindrops and leaves
    // use Math.random, since they only change how it looks.
    constructor(kind, width, height, windScale, gameRandom) {
        this.kind = kind;
        this.windScale = windScale ?? 1;
        this.width = width;
        this.height = height;
        this.windDirection = (gameRandom ?? Math.random)() < 0.5 ? -1 : 1;
        this.ticks = 0;
        this.bits = [];
        this.splashes = [];

        const counts = {rain: 80, snow: 70, ash: 45, wind: 16, clear: 0};
        for (let i = 0; i < counts[kind]; i++) {
            this.bits.push(this.makeBit(true));
        }
    }

    getLabel() {
        return LABELS[this.kind];
    }

    getAmbience() {
        return this.kind === "rain" || this.kind === "wind" ? this.kind : null;
    }

    // How hard the wind pushes right (or left, when it's negative) this tick. It comes in gusts.
    getWind() {
        if (this.kind !== "wind") {
            return 0;
        }
        return this.windDirection * (0.005 + 0.003 * dsin(this.ticks / 160)) * this.windScale;
    }

    // How fast a boulder rolls going this way: slower in the rain, faster going with the wind
    getBoulderSpeed(dx) {
        if (this.kind === "rain") {
            return 0.8;
        }
        if (this.kind === "wind") {
            return 1 + 0.3 * this.windDirection * dx;
        }
        return 1;
    }

    // One raindrop, snowflake, bit of ash or leaf. Spread over the whole screen at the start, then from the top.
    makeBit(anywhere) {
        const bit = {
            x: random(-20, this.width + 20),
            y: anywhere ? random(0, this.height) : random(-20, -2),
            ground: random(10, this.height), // where a raindrop lands
            phase: random(0, Math.PI * 2),
            big: Math.random() < 0.25,
        };
        if (this.kind === "wind") {
            // Leaves blow in from the side the wind comes from
            bit.x = anywhere ? random(0, this.width) : (this.windDirection > 0 ? -4 : this.width + 4);
            bit.y = random(10, this.height);
            bit.color = ["#6aa04a", "#a07a3a", "#c89a40", "#4a8030"][Math.floor(Math.random() * 4)];
        }
        if (this.kind === "ash") {
            bit.glow = Math.random() < 0.2;
        }
        return bit;
    }

    update() {
        this.ticks++;
        const drift = this.kind === "wind" ? this.getWind() / this.windScale * 220 : 0;
        for (let i = 0; i < this.bits.length; i++) {
            const bit = this.bits[i];
            if (this.kind === "rain") {
                bit.x -= 0.6;
                bit.y += 3.2;
                if (bit.y >= bit.ground) {
                    this.splashes.push({x: bit.x, y: bit.ground, life: 6});
                    this.bits[i] = this.makeBit(false);
                }
            } else if (this.kind === "snow" || this.kind === "ash") {
                bit.x += Math.sin(this.ticks / 40 + bit.phase) * 0.15;
                bit.y += this.kind === "snow" ? 0.28 : 0.18;
                if (bit.y > this.height) {
                    this.bits[i] = this.makeBit(false);
                }
            } else if (this.kind === "wind") {
                bit.x += drift * (bit.big ? 1 : 1.4);
                bit.y += Math.sin(this.ticks / 20 + bit.phase) * 0.3;
                if (bit.x < -6 || bit.x > this.width + 6) {
                    this.bits[i] = this.makeBit(false);
                }
            }
        }
        for (const splash of this.splashes) {
            splash.life--;
        }
        this.splashes = this.splashes.filter(splash => splash.life > 0);
    }

    draw() {
        if (this.kind === "rain") {
            // A little darker under the clouds
            MDog.Draw.rectangleFill(0, 0, this.width, this.height, "rgba(30, 40, 70, 0.16)");
            for (const bit of this.bits) {
                MDog.Draw.line(bit.x, bit.y, bit.x - 1, bit.y + 3, "rgba(190, 210, 255, 0.55)");
            }
            for (const splash of this.splashes) {
                const spread = splash.life > 3 ? 1 : 2;
                MDog.Draw.rectangleFill(Math.round(splash.x) - spread, Math.round(splash.y), 1, 1, "rgba(220, 230, 255, 0.6)");
                MDog.Draw.rectangleFill(Math.round(splash.x) + spread, Math.round(splash.y), 1, 1, "rgba(220, 230, 255, 0.6)");
            }
        } else if (this.kind === "snow") {
            for (const bit of this.bits) {
                const size = bit.big ? 2 : 1;
                MDog.Draw.rectangleFill(Math.round(bit.x), Math.round(bit.y), size, size, "rgba(255, 255, 255, 0.9)");
            }
        } else if (this.kind === "ash") {
            MDog.Draw.rectangleFill(0, 0, this.width, this.height, "rgba(60, 20, 10, 0.1)");
            for (const bit of this.bits) {
                const color = bit.glow ? "rgba(255, 140, 50, 0.8)" : "rgba(120, 110, 110, 0.7)";
                MDog.Draw.rectangleFill(Math.round(bit.x), Math.round(bit.y), 1, 1, color);
            }
        } else if (this.kind === "wind") {
            for (const bit of this.bits) {
                const flip = Math.floor(this.ticks / 8 + bit.phase) % 2 === 0;
                MDog.Draw.rectangleFill(Math.round(bit.x), Math.round(bit.y), flip ? 2 : 1, flip ? 1 : 2, bit.color);
                if (bit.big) {
                    // A faint streak of wind behind it
                    MDog.Draw.rectangleFill(Math.round(bit.x) - this.windDirection * 8, Math.round(bit.y) + 2, 6, 1, "rgba(255, 255, 255, 0.15)");
                }
            }
        }
    }
}

export default Weather;
