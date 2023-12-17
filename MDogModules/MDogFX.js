import Module from "./MDogModule.js";
import Maths from "./MDogMaths.js";

const Vector = (new Maths()).Vector;

class FX extends Module {
    constructor() {
        super();

        this.ParticleSystem = ParticleSystem;
        this.Particle = Particle;
        this.ChunkParticle = ChunkParticle;
        this.LineParticle = LineParticle;
    }
}

class Particle {
    constructor(x, y, life, settings) {
        this.position = new Vector(x, y);
        this.life = life;
        settings = settings ?? {};
        this.tags = settings.tags ?? [];
        this.layer = settings.layer ?? 0;
    }

    hasTag(tag) {
        return this.tags.includes(tag);
    }

    getX() {
        return this.position.x;
    }

    getY() {
        return this.position.y;
    }

    _update() {};
    _draw() {};
}

// Extra perams: gx, gy, size, layer, tags
class ChunkParticle extends Particle {
    constructor(x, y, life, color, vx, vy, settings) {
        settings = settings ?? {};
        super(x, y, life, {layer: settings.layer, tags: settings.tags});
        this.color = color;
        this.velocity = new Vector(vx, vy);
        this.gx = settings.gx ?? 0;
        this.gy = settings.gy ?? 0;
        this.size = settings.size ?? 1;
    }

    _update() {
        this.velocity.x += this.gx;
        this.velocity.y += this.gy;
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }

    _draw(Draw) {
        Draw.rectangleFill(
            Math.floor(this.position.x - this.size/2),
            Math.floor(this.position.y - this.size/2),
            this.size,
            this.size,
            this.color,
            {layer: this.layer});
    }
}

// Extra perams: gx, gy, layer, tags
class LineParticle extends Particle {
    constructor(x, y, life, color, vx, vy, settings) {
        settings = settings ?? {};
        super(x, y, life, {layer: settings.layer, tags: settings.tags});
        this.color = color;
        this.velocity = new Vector(vx, vy);
        this.gx = settings.gx ?? 0;
        this.gy = settings.gy ?? 0;
        this.length = settings.length ?? null;
    }

    _update() {
        this.velocity.x += this.gx;
        this.velocity.y += this.gy;
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }

    _draw(Draw) {

        const extend = this.velocity.clone();
        if (this.length !== null) {
            extend.normalize();
            extend.multiply(this.length);
        }

        Draw.line(
            Math.floor(this.position.x),
            Math.floor(this.position.y),
            Math.floor(this.position.x + extend.x),
            Math.floor(this.position.y + extend.y),
            this.color,
            {layer: this.layer});
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    addParticle(particle) {
        this.particles.push(particle);
    }

    clear() {
        this.particles = [];
    }

    update() {
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].life--;
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
                i--;
            } else {
                this.particles[i]._update();
            }
        }
    }

    _draw(Draw) {
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i]._draw(Draw);
        }
    }

    count() {
        return this.particles.length;
    }

    isEmpty() {
        return this.particles.length === 0;
    }
}

export default FX;