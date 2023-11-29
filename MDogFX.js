import Module from "/MDogModule.js";
import Maths from "/MDogMaths.js";

const Vector = (new Maths()).Vector;

class FX extends Module {
    constructor() {
        super();

        this.ParticleSystem = ParticleSystem;
        this.Particle = Particle;
        this.ChunkParticle = ChunkParticle;
    }
}

class Particle {
    constructor(x, y, life) {
        this.position = new Vector(x, y);
        this.life = life;
    }

    _update() {};
    _draw() {};
}

// Extra perams: gx, gy, size
class ChunkParticle extends Particle {
    constructor(x, y, life, color, vx, vy, settings) {
        super(x, y, life);
        settings = settings ?? {};
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
            this.color);
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
}

export default FX;