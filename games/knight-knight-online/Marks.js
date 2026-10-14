import MDog from "../../MDogModules/MDogMain.js"

// Marks left on the ground that stay: footprints, boulder tracks, burns, craters and rubble.
// They're painted onto their own canvas once, instead of being redrawn one by one every frame, and fade away
// slowly. If there's no page to make a canvas on (like in tests), marks just aren't kept.

class Marks {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.canvas = null;
        if (typeof document !== "undefined") {
            this.canvas = document.createElement("canvas");
            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx = this.canvas.getContext("2d");
        }
        this.ticks = 0;
    }

    clear() {
        if (this.canvas !== null) {
            this.ctx.clearRect(0, 0, this.width, this.height);
        }
    }

    dot(x, y, width, height, color) {
        if (this.canvas !== null) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(Math.round(x), Math.round(y), width, height);
        }
    }

    // Everything fades a little every couple of seconds, so old marks go away
    update() {
        this.ticks++;
        if (this.canvas !== null && this.ticks % 320 === 0) {
            this.ctx.globalCompositeOperation = "destination-out";
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.globalCompositeOperation = "source-over";
        }
    }

    footprint(x, y, color) {
        this.dot(x, y, 2, 1, color);
    }

    // The flattened line a boulder leaves behind it
    track(x, y, width, horizontal, color) {
        if (horizontal) {
            this.dot(x, y - width / 2, 1, 1, color);
            this.dot(x, y + width / 2, 1, 1, color);
        } else {
            this.dot(x - width / 2, y, 1, 1, color);
            this.dot(x + width / 2, y, 1, 1, color);
        }
    }

    scorch(x, y) {
        this.dot(x - 5, y - 1, 10, 3, "rgba(30, 24, 12, 0.35)");
        this.dot(x - 7, y, 14, 1, "rgba(30, 24, 12, 0.3)");
        this.dot(x - 2, y, 4, 1, "rgba(10, 8, 4, 0.4)");
    }

    // Where a catapult rock landed
    crater(x, y) {
        this.dot(x - 6, y - 2, 12, 5, "rgba(50, 36, 20, 0.35)");
        this.dot(x - 8, y - 1, 16, 3, "rgba(50, 36, 20, 0.3)");
        this.dot(x - 4, y - 1, 8, 2, "rgba(20, 14, 8, 0.35)");
        this.dot(x - 6, y - 3, 12, 1, "rgba(255, 255, 255, 0.12)");
    }

    // Bits of a broken rock left lying around
    rubble(x, y) {
        const colors = ["rgba(132, 126, 135, 0.9)", "rgba(98, 93, 106, 0.9)", "rgba(176, 172, 184, 0.8)"];
        for (let i = 0; i < 14; i++) {
            const size = Math.random() < 0.3 ? 2 : 1;
            this.dot(x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 8, size, size, colors[i % 3]);
        }
    }

    draw() {
        if (this.canvas !== null) {
            // The engine's image drawing only takes file names, but its raw drawing takes any canvas
            MDog.Draw._rawImage(this.canvas, 0, 0, this.width, this.height);
        }
    }
}

export default Marks;
