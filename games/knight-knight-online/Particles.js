import MDog from "../../MDogModules/MDogMain.js"

// Little pixels that fly off of things, built on MDog's particles (MDog.FX).
//
// MDog's ChunkParticle moves across the screen with gravity pulling it down the screen, which suits confetti. But
// this game is seen from above, so most of its particles need a spot on the ground (x, y) and a height above it
// (z), to pop up into the air and land on the ground, instead of falling off the bottom of the screen. They also
// slow down and fade out. So those are made as their own kind of MDog particle (GroundParticle), and MDog's
// ParticleSystem updates and draws all of them.

const DUST = [196, 204, 164];
const SPARK = [255, 238, 170];
const ROCK_COLORS = [[132, 126, 135], [98, 93, 106], [176, 172, 184]];
const GRASS_COLORS = [[98, 160, 76], [56, 110, 46], [130, 186, 96]];
const SHARD_COLORS = [[225, 240, 255], [110, 170, 240], [170, 210, 250]];
const BLOOD_COLORS = [[170, 18, 18], [120, 10, 10], [200, 36, 36]];
const EMBER_COLORS = [[255, 200, 60], [242, 120, 40], [214, 62, 40]];
const CONFETTI_COLORS = ["#d04848", "#6a96ea", "#ffcc33", "#ffffff", "#8cd278"];

function random(min, max) {
    return min + Math.random() * (max - min);
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

// A particle with a height above the ground. Its position is the spot on the ground under it.
class GroundParticle extends MDog.FX.Particle {
    constructor(x, y, settings) {
        super(x, y, settings.life);
        this.maxLife = settings.life;
        this.z = settings.z ?? 0;
        this.vx = settings.vx ?? 0;
        this.vy = settings.vy ?? 0;
        this.vz = settings.vz ?? 0;
        this.gravity = settings.gravity ?? 0;
        this.drag = settings.drag ?? 1; // how much of its speed is left each tick
        this.color = settings.color; // [r, g, b], so it can fade
        this.size = settings.size ?? 1;
        this.onLand = settings.onLand ?? null; // called with (x, y) the first time it touches the ground
    }

    // MDog's ParticleSystem counts down the life and calls this every tick
    _update() {
        this.position.x += this.vx;
        this.position.y += this.vy;
        this.z += this.vz;
        this.vz -= this.gravity;
        this.vx *= this.drag;
        this.vy *= this.drag;
        if (this.z < 0) {
            // Landed, so it stops bouncing and slides to a stop
            if (this.onLand !== null) {
                this.onLand(this.getX(), this.getY());
                this.onLand = null;
            }
            this.z = 0;
            this.vz = 0;
            this.vx *= 0.5;
            this.vy *= 0.5;
        }
    }

    _draw(Draw) {
        // Fades out over the second half of its life
        const alpha = Math.min(1, this.life / this.maxLife * 2);
        const [r, g, b] = this.color;
        Draw.rectangleFill(Math.round(this.getX()), Math.round(this.getY() - this.z), this.size, this.size, `rgba(${r}, ${g}, ${b}, ${alpha})`);
    }
}

// A little four pointed twinkle, like light catching metal
class Glint extends MDog.FX.Particle {
    constructor(x, y) {
        super(x, y, 14);
        this.maxLife = 14;
    }

    _draw(Draw) {
        const x = Math.round(this.getX());
        const y = Math.round(this.getY());
        const reach = this.life > this.maxLife / 2 ? 2 : 1; // shrinks as it goes
        const color = "rgba(255, 255, 255, 0.95)";
        Draw.rectangleFill(x, y, 1, 1, color);
        Draw.rectangleFill(x - reach, y, reach, 1, color);
        Draw.rectangleFill(x + 1, y, reach, 1, color);
        Draw.rectangleFill(x, y - reach, 1, reach, color);
        Draw.rectangleFill(x, y + 1, 1, reach, color);
    }
}

// The kinds of particles the game makes, all kept in one MDog ParticleSystem
class Particles {
    constructor() {
        this.system = new MDog.FX.ParticleSystem();
    }

    clear() {
        this.system.clear();
    }

    update() {
        this.system.update();
    }

    draw() {
        MDog.Draw.particleSystem(this.system);
    }

    add(x, y, settings) {
        this.system.addParticle(new GroundParticle(x, y, settings));
    }

    // Kicked up by feet
    dust(x, y, count) {
        for (let i = 0; i < count; i++) {
            this.add(x + random(-3, 3), y, {
                vx: random(-0.2, 0.2), vy: random(-0.1, 0.1), vz: random(0.1, 0.3), gravity: 0.01, drag: 0.95,
                life: random(20, 35), color: DUST,
            });
        }
    }

    // Metal hitting metal, or a burst of any color
    sparks(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const angle = random(0, Math.PI * 2);
            const speed = random(0.6, 1.6);
            this.add(x, y, {
                z: 0.1, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, drag: 0.9,
                life: random(10, 22), color: color ?? SPARK,
            });
        }
    }

    // Bits of a broken boulder or rock (or anything else, given its colors)
    debris(x, y, count, colors) {
        for (let i = 0; i < count; i++) {
            this.add(x + random(-4, 4), y + random(-3, 3), {
                z: random(0, 6), vx: random(-0.7, 0.7), vy: random(-0.5, 0.5), vz: random(0.4, 1.1), gravity: 0.05,
                life: random(70, 110), color: pick(colors ?? ROCK_COLORS), size: Math.random() < 0.3 ? 2 : 1,
            });
        }
    }

    // Grass cut by a sword
    clippings(x, y, count) {
        for (let i = 0; i < count; i++) {
            this.add(x + random(-2, 2), y + random(-2, 2), {
                z: random(0, 3), vx: random(-0.5, 0.5), vy: random(-0.4, 0.4), vz: random(0.3, 0.8), gravity: 0.03,
                drag: 0.97, life: random(50, 80), color: pick(GRASS_COLORS),
            });
        }
    }

    // A shield bubble breaking
    shards(x, y, count) {
        for (let i = 0; i < count; i++) {
            const angle = random(0, Math.PI * 2);
            const speed = random(0.5, 1.3);
            this.add(x, y, {
                z: random(4, 12), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.6, vz: random(0.2, 0.8),
                gravity: 0.04, drag: 0.96, life: random(40, 70), color: pick(SHARD_COLORS),
            });
        }
    }

    // Falls from the top of the screen. Plain screen movement, so this one is just an MDog ChunkParticle.
    confetti(screenWidth, count) {
        for (let i = 0; i < count; i++) {
            this.system.addParticle(new MDog.FX.ChunkParticle(
                random(0, screenWidth), random(-12, -2), 700, pick(CONFETTI_COLORS),
                random(-0.15, 0.15), random(0.2, 0.45), {size: Math.random() < 0.3 ? 2 : 1},
            ));
        }
    }

    // Spurts up and out, and splatters where it lands
    blood(x, y, count, onLand) {
        for (let i = 0; i < count; i++) {
            this.add(x + random(-2, 2), y, {
                z: random(3, 7), vx: random(-0.6, 0.6), vy: random(-0.35, 0.35), vz: random(0.4, 1.2), gravity: 0.05,
                drag: 0.98, life: random(50, 90), color: BLOOD_COLORS[Math.floor(Math.random() * BLOOD_COLORS.length)],
                onLand: onLand,
            });
        }
    }

    // Little sparks of fire that float up
    embers(x, y, count) {
        for (let i = 0; i < count; i++) {
            this.add(x + random(-4, 4), y, {
                z: random(2, 12), vx: random(-0.1, 0.1), vy: random(-0.05, 0.05), vz: random(0.1, 0.3), gravity: -0.002,
                life: random(25, 45), color: pick(EMBER_COLORS),
            });
        }
    }

    glint(x, y) {
        this.system.addParticle(new Glint(x, y));
    }

    // Plume feathers that flutter down slowly
    feathers(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.add(x, y, {
                z: 12, vx: random(-0.5, 0.5), vy: random(-0.3, 0.3), vz: random(0.2, 0.6), gravity: 0.006, drag: 0.98,
                life: random(110, 170), color: color,
            });
        }
    }
}

export default Particles;
