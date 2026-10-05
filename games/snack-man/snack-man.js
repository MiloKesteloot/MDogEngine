/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                                                                      ║
 * ║              ███████ ███    ██  █████   ██████ ██   ██               ║
 * ║              ██      ████   ██ ██   ██ ██      ██  ██                ║
 * ║              ███████ ██ ██  ██ ███████ ██      █████                 ║
 * ║                   ██ ██  ██ ██ ██   ██ ██      ██  ██                ║
 * ║              ███████ ██   ████ ██   ██  ██████ ██   ██               ║
 * ║                                                                      ║
 * ║                     ███    ███  █████  ███    ██                     ║
 * ║                     ████  ████ ██   ██ ████   ██                     ║
 * ║                     ██ ████ ██ ███████ ██ ██  ██                     ║
 * ║                     ██  ██  ██ ██   ██ ██  ██ ██                     ║
 * ║                     ██      ██ ██   ██ ██   ████                     ║
 * ║                                                                      ║
 * ║                            ~ REMASTERED ~                            ║
 * ║                                                                      ║
 * ║   This file was written by Claude (Anthropic's AI), as a remaster    ║
 * ║   of Milo's original Snack Man (see games/snack-man-old).            ║
 * ║                                                                      ║
 * ║   Pac-Man meets Snake: every pellet you eat makes you one tile       ║
 * ║   longer, and running into your own body ends the run.               ║
 * ║                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import MDog from "../../MDogModules/MDogMain.js"
import Controls, {KEY_BUFFER_TICKS} from "./Controls.js";
import Sound, {START_JINGLE_SECONDS} from "./Sound.js";
import Scoreboard from "./Scoreboard.js";
import NameInput from "./NameInput.js";

// Just big enough for the maze, the score above it and the hints below it. A tall, narrow screen
// gets scaled up much bigger on phones (held upright) than MDog's default wide one.
MDog.Draw.setScreenSize(240, 328);

const DIRS = {
    up: {x: 0, y: -1},
    down: {x: 0, y: 1},
    left: {x: -1, y: 0},
    right: {x: 1, y: 0}
}

// ---------- Tuning ----------

const TICKS_PER_SECOND = 160; // MDog runs the active function at a fixed 160 ticks per second
const SPEED = 7.5 / TICKS_PER_SECOND; // tiles per tick, on level 1
const SPEED_PER_LEVEL = 0.08; // each level after the first is this much faster...
const MAX_SPEED_MULTIPLIER = 1.4; // ...up to this
const LATE_TURN_WINDOW = 0.25; // how far past a tile center (in tiles) you can still turn
const BLOCKED_GRACE_TICKS = 24; // at a junction, time to take the open way when straight ahead is your body (0.15s)
const CHOMP_PIXELS = 2.5; // pixels travelled per mouth frame
const CHOMP_FRAMES = [1, 2, 3, 2];
const STOPPED_MOUTH_FRAME = 2; // half open when he's stopped, so you can tell which way he's facing
const DEATH_FREEZE_TICKS = 50; // how long he flashes before his tail slides back in
const UNRAVEL_MIN_TICKS = 80; // even a tiny tail takes this long to slide back in, so the ease is visible
const UNRAVEL_MAX_TICKS = 280; // even a huge tail is back in by this point
const UNRAVEL_SPEED = 0.75; // average pixels per tick for tails in between
const UNRAVEL_END_SPEED = 0.3; // how fast the tail is still sliding when it finishes, as a fraction of its average speed (0 eases to a full stop)
const DEATH_HOLD_TICKS = 0; // pause once the tail is gone, before the classic death (0 spins straight away)
const DEATH_SPIN_TICKS = 176; // mouth opens all the way while he spins
const DEATH_SPINS = 1.5; // full turns during the spin
const DEATH_SPIN_START_SPEED = 0.3; // how fast the spin starts, as a fraction of its average speed (0 starts from a standstill)
const DEATH_POP_TICKS = 40;
const DEATH_AFTER_TICKS = 40; // empty pause before you're put back in
const PELLET_POINTS = 10;
const BLUE_FLASH_TICKS = 22; // while blue he slowly flashes blue/white, this long per color
const BITE_CHOMP_TICKS = 24; // big chomp when he bites himself
const SHAKE_TICKS = 14;
const SHAKE_AMOUNT = 2; // pixels
const PIECE_FLASH_TICKS = 36; // the bitten-off piece flashes before it starts popping
const PIECE_POP_MIN_TICKS = 3; // fastest a long piece pops, per segment
const PIECE_POP_MAX_TICKS = 10; // slowest a short piece pops, per segment
const PIECE_POP_TOTAL_TICKS = 140; // roughly how long popping a whole piece takes
const LOSS_TEXT_TICKS = 50; // how long a "-10" floats up from a popped segment
const CLEAR_PAUSE_TICKS = 60; // after the last pellet, everything freezes for a moment...
const CLEAR_FLASH_TICKS = 24; // ...then the maze flashes white, this long per flash...
const CLEAR_FLASHES = 8; // ...this many times, and the next level starts
const BEST_SCORE_KEY = "snack-man-best";
const VIBRATION_KEY = "snack-man-vibration";
// How many power pellets each level has. After these, it's 2 to 6, picked by powerPelletCount().
const POWER_PELLETS_PER_LEVEL = [4, 4, 2, 6, 3, 8, 1, 7]; // levels 1 to 8
const MIN_POWER_PELLETS = 2;
const MAX_POWER_PELLETS = 6;
const POWER_PELLET_MIN_DISTANCE = 4 * 6.5; // pixels between random power pellets: 4 snack man radiuses
const BONUS_POINTS = 200; // a power pellet eaten while already blue; each one after that is worth double
const BONUS_FREEZE_TICKS = 100; // like eating a ghost in Pac-Man, everything stops while the points show

// ---------- Maze ----------

const TILE = 8;
const COLS = 28;
const ROWS = 31;
const MAZE_WIDTH = COLS * TILE;
const MAZE_HEIGHT = ROWS * TILE;
const MAZE_X = Math.floor((MDog.Draw.getScreenWidthInArtPixels() - MAZE_WIDTH) / 2);
const MAZE_Y = Math.floor((MDog.Draw.getScreenHeightInArtPixels() - MAZE_HEIGHT) / 2);

const WALL = "#";
const PELLET = ".";
const POWER = "o";
const EMPTY = " ";

// Matches assets/snack-man/map.png
const LAYOUT = [
    "############################",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o####.#####.##.#####.####o#",
    "#.####.#####.##.#####.####.#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
    "######.##### ## #####.######",
    "######.##### ## #####.######",
    "######.##          ##.######",
    "######.## ######## ##.######",
    "######.## ######## ##.######",
    "      .   ########   .      ",
    "######.## ######## ##.######",
    "######.## ######## ##.######",
    "######.##          ##.######",
    "######.## ######## ##.######",
    "######.## ######## ##.######",
    "#............##............#",
    "#.####.##### ## #####.####.#",
    "#.####.##### ## #####.####.#",
    "#o..##....        ....##..o#",
    "###.##.##.########.##.##.###",
    "###.##.##.########.##.##.###",
    "#......##....##....##......#",
    "#.##########.##.##########.#",
    "#.##########.##.##########.#",
    "#..........................#",
    "############################",
];

// Like Pac-Man, he starts halfway between two tiles, in the middle of the maze
const START_TILE = {x: 14, y: 23};
const START_DIR = DIRS.left;
const START_PROGRESS = 0.5;
const READY_TICKS = Math.round((START_JINGLE_SECONDS + 0.5) * TICKS_PER_SECOND); // READY! shows this long, then he sets off on his own

// Where READY! and the other messages go (the open row under the middle box, like Pac-Man)
const MESSAGE_X = 14 * 8;
const MESSAGE_Y = 17 * 8 + 4;

const COLORS = {
    background: "#000000",
    pellet: "#ffb9af",
    snack: "#ffff00",
    blue: "#1a1acc", // a bit darker than the map walls (#2121ff), since a big solid shape looks brighter than thin lines
    flash: "#ffffff",
    text: "#ffffff",
    scoreDrain: "#ff5a5a",
    label: "#dedeff",
    bonus: "#00ffff", // Pac-Man's ghost-points cyan
    wall: "#2121ff",
    dim: "#5a5a8c",
    loss: "#ff2a2a"
}

// ---------- Helpers ----------

function wrapX(x) {
    return ((x % COLS) + COLS) % COLS;
}

function step(tile, dir) {
    return {x: wrapX(tile.x + dir.x), y: tile.y + dir.y};
}

function sameTile(a, b) {
    return a.x === b.x && a.y === b.y;
}

function tileIndex(tile) {
    return tile.x + tile.y * COLS;
}

// Pixel at the middle of a tile (the 13x13 sprites are centered on it)
function center(tile) {
    return {x: tile.x * TILE + 4, y: tile.y * TILE + 4};
}

// The 13x13 snack man circle, as [x, y, width, height] rows
const CIRCLE_SIZE = 13;
const CIRCLE_SPANS = [
    [4, 0, 5, 1],
    [2, 1, 9, 1],
    [1, 2, 11, 2],
    [0, 4, 13, 5],
    [1, 9, 11, 2],
    [2, 11, 9, 1],
    [4, 12, 5, 1]
];

// The part of the trail closer than this to the head center counts as his neck
const NECK_LENGTH = 7;

// CIRCLE_MASK[y][x] is true for pixels inside the 13x13 circle
const CIRCLE_MASK = [];
for (let y = 0; y < CIRCLE_SIZE; y++) {
    CIRCLE_MASK.push(new Array(CIRCLE_SIZE).fill(false));
}
for (const [dx, dy, w, h] of CIRCLE_SPANS) {
    for (let y = dy; y < dy + h; y++) {
        for (let x = dx; x < dx + w; x++) {
            CIRCLE_MASK[y][x] = true;
        }
    }
}

// Snack man with his mouth open by any amount, facing any angle (used for the death animation)
function pie(x, y, facing, halfMouth, color) {
    const half = Math.floor(CIRCLE_SIZE / 2);
    for (let j = 0; j < CIRCLE_SIZE; j++) {
        let runStart = -1;
        for (let i = 0; i <= CIRCLE_SIZE; i++) {
            let filled = false;
            if (i < CIRCLE_SIZE && CIRCLE_MASK[j][i]) {
                if (i === half && j === half) {
                    filled = halfMouth < Math.PI * 0.95;
                } else {
                    let diff = Math.atan2(j - half, i - half) - facing;
                    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // wrap to -PI..PI
                    filled = Math.abs(diff) >= halfMouth;
                }
            }
            if (filled && runStart === -1) {
                runStart = i;
            } else if (!filled && runStart !== -1) {
                MDog.Draw.rectangleFill(x - half + runStart, y - half + j, i - runStart, 1, color);
                runStart = -1;
            }
        }
    }
}

function circle(x, y, color) {
    const half = Math.floor(CIRCLE_SIZE / 2);
    for (const [dx, dy, w, h] of CIRCLE_SPANS) {
        MDog.Draw.rectangleFill(x - half + dx, y - half + dy, w, h, color);
    }
}

// The 8x8 power pellet, as [x, y, width, height] rows
const POWER_SPANS = [
    [2, 0, 4, 1],
    [1, 1, 6, 1],
    [0, 2, 8, 4],
    [1, 6, 6, 1],
    [2, 7, 4, 1]
];

// Centers of a run of tiles, unwrapped across the tunnel so the path stays continuous
function tilePath(tiles, from) {
    const points = [];
    let last = from ?? null;
    for (const tile of tiles) {
        const c = center(tile);
        if (last !== null) {
            while (c.x - last.x > MAZE_WIDTH / 2) c.x -= MAZE_WIDTH;
            while (last.x - c.x > MAZE_WIDTH / 2) c.x += MAZE_WIDTH;
        }
        points.push(c);
        last = c;
    }
    return points;
}

function wrapPixelX(x) {
    return ((x % MAZE_WIDTH) + MAZE_WIDTH) % MAZE_WIDTH;
}

// When something is in the tunnel, it also gets drawn on the other side
function tunnelOffsets(points) {
    const offsets = [0];
    if (points.some(p => p.x < 8)) offsets.push(MAZE_WIDTH);
    if (points.some(p => p.x > MAZE_WIDTH - 8)) offsets.push(-MAZE_WIDTH);
    return offsets;
}

function isStraight(a, b, c) {
    return Math.sign(b.x - a.x) === Math.sign(c.x - b.x) && Math.sign(b.y - a.y) === Math.sign(c.y - b.y);
}

// Draws a stretch of trail along a path. roundEnd rounds off its last point (used for the tail tip).
function drawTrail(points, offsetX, color, roundEnd) {
    const half = Math.floor(CIRCLE_SIZE / 2);
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        if (a.x === b.x) {
            MDog.Draw.rectangleFill(a.x - half + offsetX, Math.min(a.y, b.y), CIRCLE_SIZE, Math.abs(a.y - b.y) + 1, color);
        } else {
            MDog.Draw.rectangleFill(Math.min(a.x, b.x) + offsetX, a.y - half, Math.abs(a.x - b.x) + 1, CIRCLE_SIZE, color);
        }
    }

    // Round off the corners
    for (let i = 1; i < points.length; i++) {
        const isEnd = i === points.length - 1;
        if (isEnd ? roundEnd : !isStraight(points[i - 1], points[i], points[i + 1])) {
            circle(points[i].x + offsetX, points[i].y, color);
        }
    }
}

// The circle rounds the outside of each turn; this softens the inside with one pixel in the sharp corner.
// That pixel is just past the band's edge: a step back the way he came, and a step over the way he turned.
// It's only drawn once the body reaches past it on both sides (his head has moved far enough along after
// turning, and his tail hasn't pulled back too close), otherwise it would float there on its own.
// Pass the whole path, not the neck and the rest separately, so the lengths are measured right.
function drawInnerCorners(points, offsetX, color) {
    const reach = Math.floor(CIRCLE_SIZE / 2) + 1;
    for (let i = 1; i < points.length - 1; i++) {
        const before = points[i - 1];
        const corner = points[i];
        const after = points[i + 1];
        const inX = Math.sign(corner.x - before.x);
        const inY = Math.sign(corner.y - before.y);
        const outX = Math.sign(after.x - corner.x);
        const outY = Math.sign(after.y - corner.y);
        const turning = (inX !== 0 || inY !== 0) && (outX !== 0 || outY !== 0) && inX * outX + inY * outY === 0;
        const lengthIn = Math.abs(corner.x - before.x) + Math.abs(corner.y - before.y);
        const lengthOut = Math.abs(after.x - corner.x) + Math.abs(after.y - corner.y);
        if (turning && lengthIn >= reach && lengthOut >= reach) {
            MDog.Draw.rectangleFill(corner.x + (outX - inX) * reach + offsetX, corner.y + (outY - inY) * reach, 1, 1, color);
        }
    }
}

// ---------- Recolored images ----------

// To draw an image in another color (Snack Man turning blue, the maze flashing white), each image is read once
// and turned into a list of rectangles covering its pixels, which can then be drawn in any color.
// (MDog's tint setting does the same job, but it builds a new canvas every time it draws.)
const shapes = new Map();

function loadShape(fileName) {
    let shape = shapes.get(fileName);
    if (shape !== undefined) {
        return shape;
    }

    shape = {rects: null, width: 0, height: 0};
    shapes.set(fileName, shape);

    const image = new Image();
    image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, image.width, image.height).data;

        shape.rects = pixelsToRects(pixels, image.width, image.height);
        shape.width = image.width;
        shape.height = image.height;
    };
    image.src = "assets/" + fileName;
    return shape;
}

// Covers the solid pixels with rectangles: a run of pixels in a row, stretched down while the rows below
// have the exact same run (so straight wall lines become one tall rectangle instead of many short ones)
function pixelsToRects(pixels, width, height) {
    const rects = [];
    let open = new Map(); // "x,width" of runs in the previous row -> the rectangle they're part of
    for (let y = 0; y < height; y++) {
        const nextOpen = new Map();
        let x = 0;
        while (x < width) {
            if (pixels[(x + y * width) * 4 + 3] < 128) {
                x += 1;
                continue;
            }
            const start = x;
            while (x < width && pixels[(x + y * width) * 4 + 3] >= 128) {
                x += 1;
            }
            const key = start + "," + (x - start);
            let rect = open.get(key);
            if (rect !== undefined) {
                rect[3] += 1;
            } else {
                rect = [start, y, x - start, 1];
                rects.push(rect);
            }
            nextOpen.set(key, rect);
        }
        open = nextOpen;
    }
    return rects;
}

// Draws an image as a solid color. Returns false if it hasn't loaded yet.
function drawRecolored(fileName, x, y, color, flipX, flipY) {
    const shape = loadShape(fileName);
    if (shape.rects === null) {
        return false;
    }
    for (const [rx, ry, w, h] of shape.rects) {
        const dx = flipX ? shape.width - rx - w : rx;
        const dy = flipY ? shape.height - ry - h : ry;
        MDog.Draw.rectangleFill(x + dx, y + dy, w, h, color);
    }
    return true;
}

// ---------- Particles ----------

class Particle {
    constructor(x, y, color) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.25 + Math.random() * 0.6;
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 22 + Math.floor(Math.random() * 14);
        this.maxLife = this.life;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.97;
        this.vy *= 0.97;
        this.life -= 1;
    }

    draw() {
        const size = this.life > this.maxLife / 2 ? 2 : 1;
        MDog.Draw.rectangleFill(Math.round(this.x), Math.round(this.y), size, size, this.color);
    }
}

// A "-10" that floats up from a bitten-off segment as it pops
class LossText {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.life = LOSS_TEXT_TICKS;
    }

    update() {
        this.y -= 0.15;
        this.life -= 1;
    }

    draw() {
        // Blinks out at the end instead of fading, to stay pixel-crisp
        if (this.life < LOSS_TEXT_TICKS / 4 && Math.floor(this.life / 3) % 2 === 0) {
            return;
        }
        MDog.Draw.textImage("-" + PELLET_POINTS, Math.round(this.x), Math.round(this.y), COLORS.loss, "fonts/marsfont.png", {alignX: "center", alignY: "center"});
    }
}

// Particles, floating "-10"s and screen shake. Snack Man and his bitten-off pieces add to these,
// and the game updates and draws them.
class Effects {
    constructor() {
        this.clear();
    }

    clear() {
        this.particles = [];
        this.lossTexts = [];
        this.shakeTimer = 0;
    }

    burst(x, y, count, colors) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, colors[i % colors.length]));
        }
    }

    lossText(x, y) {
        this.lossTexts.push(new LossText(x, y));
    }

    shake() {
        this.shakeTimer = SHAKE_TICKS;
    }

    // How far to nudge the whole maze this frame while shaking
    shakeOffset() {
        if (this.shakeTimer <= 0) {
            return {x: 0, y: 0};
        }
        const amount = Math.ceil(SHAKE_AMOUNT * this.shakeTimer / SHAKE_TICKS);
        return {
            x: Math.round((Math.random() * 2 - 1) * amount),
            y: Math.round((Math.random() * 2 - 1) * amount)
        };
    }

    update() {
        for (const particle of this.particles) {
            particle.update();
        }
        this.particles = this.particles.filter(particle => particle.life > 0);
        for (const text of this.lossTexts) {
            text.update();
        }
        this.lossTexts = this.lossTexts.filter(text => text.life > 0);
        if (this.shakeTimer > 0) this.shakeTimer -= 1;
    }

    draw() {
        for (const particle of this.particles) {
            particle.draw();
        }
        for (const text of this.lossTexts) {
            text.draw();
        }
    }
}

// ---------- Bitten-off piece ----------

// The part of his tail he bit off. It flashes, then pops one segment at a time,
// starting where he bit it, and your score goes down with every pop.
class SeveredPiece {
    constructor(tiles, effects, onPop) {
        this.tiles = tiles;
        this.effects = effects;
        this.onPop = onPop;
        this.points = tilePath(tiles);
        this.timer = 0;
        this.popped = 0;
        this.popInterval = Math.max(PIECE_POP_MIN_TICKS, Math.min(PIECE_POP_MAX_TICKS, Math.floor(PIECE_POP_TOTAL_TICKS / tiles.length)));
    }

    isDone() {
        return this.tiles.length === 0;
    }

    update() {
        this.timer += 1;
        if (this.timer < PIECE_FLASH_TICKS) {
            return;
        }
        if ((this.timer - PIECE_FLASH_TICKS) % this.popInterval === 0 && this.tiles.length > 0) {
            this.tiles.shift();
            const popped = this.points.shift();
            const x = wrapPixelX(popped.x);
            this.effects.burst(x, popped.y, 6, [COLORS.loss, COLORS.loss, COLORS.flash]);
            this.onPop();
            // Only every other segment gets a "-10" so they don't pile up; it's just there to show it's bad
            if (this.popped % 2 === 0) {
                this.effects.lossText(x, popped.y);
            }
            this.popped += 1;
        }
    }

    draw() {
        if (this.points.length === 0) {
            return;
        }
        const flashing = this.timer < PIECE_FLASH_TICKS;
        const color = flashing && Math.floor(this.timer / 6) % 2 === 1 ? COLORS.blue : COLORS.flash;
        for (const offsetX of tunnelOffsets(this.points)) {
            drawTrail(this.points, offsetX, color, true);
            drawInnerCorners(this.points, offsetX, color);
            circle(this.points[0].x + offsetX, this.points[0].y, color);
        }
    }
}

// ---------- Board ----------

// How many power pellets a level has. Past the hand-picked first levels it looks random, but it's
// worked out from the level number alone, so a given level always has the same number for everyone.
// It's never the same as the level before. (Where they go is still random each time.)
function powerPelletCount(level) {
    if (level <= POWER_PELLETS_PER_LEVEL.length) {
        return POWER_PELLETS_PER_LEVEL[level - 1];
    }

    // Walk forward from the last hand-picked level, so each level knows the one before it
    let previous = POWER_PELLETS_PER_LEVEL[POWER_PELLETS_PER_LEVEL.length - 1];
    for (let l = POWER_PELLETS_PER_LEVEL.length + 1; l <= level; l++) {
        // Choose from every count except the previous one, by numbering the choices and skipping over it
        const choices = [];
        for (let count = MIN_POWER_PELLETS; count <= MAX_POWER_PELLETS; count++) {
            if (count !== previous) {
                choices.push(count);
            }
        }
        previous = choices[scramble(l) % choices.length];
    }
    return previous;
}

// Turns a number into a big, random-looking whole number (a simple integer hash). The same number in
// always gives the same number out.
function scramble(n) {
    let hash = Math.imul(n, 2654435761) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 15), 2246822519) >>> 0;
    return (hash ^ (hash >>> 13)) >>> 0;
}

class Board {
    constructor() {
        this.reset();
    }

    // Level 1 uses the normal power pellets; later levels move them to random spots
    reset(level) {
        this.tiles = LAYOUT.join("").split("");
        level = level ?? 1;
        if (level > 1) {
            this.randomizePowerPellets(powerPelletCount(level));
        }
        this.pelletsLeft = this.tiles.filter(t => t === PELLET || t === POWER).length;
        this.totalPellets = this.pelletsLeft;
    }

    randomizePowerPellets(count) {
        const pellets = [];
        for (let i = 0; i < this.tiles.length; i++) {
            if (this.tiles[i] === POWER) {
                this.tiles[i] = PELLET;
            }
            if (this.tiles[i] === PELLET) {
                pellets.push(center({x: i % COLS, y: Math.floor(i / COLS)}));
            }
        }

        // Shuffle, then take pellets in that order, skipping any too close to one already picked
        for (let i = pellets.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pellets[i], pellets[j]] = [pellets[j], pellets[i]];
        }
        const picked = [];
        for (const p of pellets) {
            if (picked.length === count) {
                break;
            }
            if (picked.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= POWER_PELLET_MIN_DISTANCE)) {
                picked.push(p);
            }
        }
        for (const p of picked) {
            this.tiles[Math.floor(p.x / TILE) + Math.floor(p.y / TILE) * COLS] = POWER;
        }
    }

    get(tile) {
        if (tile.y < 0 || tile.y >= ROWS) {
            return WALL;
        }
        return this.tiles[wrapX(tile.x) + tile.y * COLS];
    }

    isWall(tile) {
        return this.get(tile) === WALL;
    }

    hasPellet(tile) {
        const t = this.get(tile);
        return t === PELLET || t === POWER;
    }

    // For testing: removes every pellet without anyone eating them, so the level is cleared
    clearAll() {
        this.tiles = this.tiles.map(t => (t === PELLET || t === POWER) ? EMPTY : t);
        this.pelletsLeft = 0;
    }

    // Returns what was eaten (PELLET, POWER or EMPTY)
    eat(tile) {
        const t = this.get(tile);
        if (t === PELLET || t === POWER) {
            this.tiles[tileIndex(tile)] = EMPTY;
            this.pelletsLeft -= 1;
            return t;
        }
        return EMPTY;
    }

    drawPellets(tick) {
        const powerVisible = Math.floor(tick / 24) % 2 === 0;
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const t = this.tiles[x + y * COLS];
                if (t === PELLET) {
                    MDog.Draw.rectangleFill(x * TILE + 3, y * TILE + 3, 2, 2, COLORS.pellet);
                } else if (t === POWER && powerVisible) {
                    for (const [dx, dy, w, h] of POWER_SPANS) {
                        MDog.Draw.rectangleFill(x * TILE + dx, y * TILE + dy, w, h, COLORS.pellet);
                    }
                }
            }
        }
    }
}

// ---------- Death ----------

// Everything that happens after he crashes into himself:
// 1. he flashes white for a moment,
// 2. his tail slides back into him, fast at first and easing out at the end,
// 3. the classic Pac-Man death: his mouth opens all the way while he spins, then he pops.
// Snack Man asks it each tick how many tail tiles to remove, and how far the current tail end has slid in.
class DeathAnimation {
    constructor(tailTiles) {
        this.timer = 0;
        this.tailLeft = tailTiles;
        this.tailPixels = tailTiles * TILE;
        this.unravelTicks = Math.min(UNRAVEL_MAX_TICKS, Math.max(UNRAVEL_MIN_TICKS, this.tailPixels / UNRAVEL_SPEED));
        this.removedPixels = 0; // tail already removed as whole tiles
        this.slidPixels = 0; // how far the current tail end has slid in
        this.finaleStart = tailTiles === 0 ? DEATH_FREEZE_TICKS : null; // when the tail finished sliding in
    }

    // Returns how many tail tiles finished sliding in this tick
    update() {
        this.timer += 1;
        if (this.timer < DEATH_FREEZE_TICKS || this.finaleStart !== null) {
            return 0;
        }

        const t = Math.min(1, (this.timer - DEATH_FREEZE_TICKS) / this.unravelTicks);
        // A cubic ease-out mixed with a bit of steady sliding, so it slows down without creeping to a stop
        const easeOut = UNRAVEL_END_SPEED * t + (1 - UNRAVEL_END_SPEED) * (1 - Math.pow(1 - t, 3));
        this.slidPixels = this.tailPixels * easeOut - this.removedPixels;

        let removed = 0;
        while (this.slidPixels >= TILE && this.tailLeft > 0) {
            this.slidPixels -= TILE;
            this.removedPixels += TILE;
            this.tailLeft -= 1;
            removed += 1;
        }
        if (this.tailLeft === 0) {
            this.slidPixels = 0;
            this.finaleStart = this.timer;
        }
        return removed;
    }

    // Ticks from the tail starting to slide in until he pops, so the death sound can last exactly that long
    ticksUntilPop() {
        const unravel = this.tailPixels > 0 ? Math.ceil(this.unravelTicks) : 0;
        return unravel + DEATH_HOLD_TICKS + DEATH_SPIN_TICKS;
    }

    isFlashing() {
        return this.timer < DEATH_FREEZE_TICKS && Math.floor(this.timer / 6) % 2 === 0;
    }

    tailSlide() {
        return Math.floor(this.slidPixels);
    }

    // Ticks since his tail finished sliding in, or -1 if it hasn't yet
    finaleFrame() {
        if (this.finaleStart === null || this.timer < this.finaleStart) {
            return -1;
        }
        return this.timer - this.finaleStart;
    }

    isOver() {
        return this.finaleFrame() > DEATH_HOLD_TICKS + DEATH_SPIN_TICKS + DEATH_POP_TICKS + DEATH_AFTER_TICKS;
    }

    drawFinale(x, y, facing) {
        const frame = this.finaleFrame();
        const popStart = DEATH_HOLD_TICKS + DEATH_SPIN_TICKS;

        if (frame < popStart) {
            const t = Math.max(0, (frame - DEATH_HOLD_TICKS) / DEATH_SPIN_TICKS);
            const halfMouth = Math.PI * Math.pow(t, 1.5);
            // Speeds up as it goes, but starts already turning instead of from a standstill
            const turned = DEATH_SPIN_START_SPEED * t + (1 - DEATH_SPIN_START_SPEED) * t * t;
            pie(x, y, facing - Math.PI * 2 * DEATH_SPINS * turned, halfMouth, COLORS.snack);
            return;
        }

        if (frame < popStart + DEATH_POP_TICKS) {
            const t = (frame - popStart) / DEATH_POP_TICKS;
            const inner = 2 + 8 * t;
            const outer = inner + 1 + 4 * (1 - t);
            for (let k = 0; k < 8; k++) {
                const angle = k * Math.PI / 4;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                MDog.Draw.line(
                    Math.round(x + cos * inner), Math.round(y + sin * inner),
                    Math.round(x + cos * outer), Math.round(y + sin * outer),
                    COLORS.snack
                );
            }
        }
    }
}

// ---------- Snack Man ----------

class SnackMan {
    // events (all optional): onEat(kind), onBite(), onBonus(points, x, y), onPiecePop(),
    //     onDie(), onDeathSound(seconds) when the tail starts sliding in (seconds until he pops), onDeathOver() once it's finished
    // input: where turns come from (pressedDirection(), bufferTicks(), isHeld(name))
    constructor(board, effects, events, input) {
        this.board = board;
        this.effects = effects;
        const nothing = () => {};
        this.events = Object.assign({
            onEat: nothing, onBite: nothing, onBonus: nothing, onPiecePop: nothing,
            onDie: nothing, onDeathSound: nothing, onDeathOver: nothing
        }, events);
        this.input = input;
        this.reset();
    }

    reset() {
        // body[0] is the tile the head is on (or leaving), the last entry is the tail
        this.body = [{x: START_TILE.x, y: START_TILE.y}];
        this.occupied = new Array(COLS * ROWS).fill(false);
        this.occupied[tileIndex(START_TILE)] = true;

        this.dir = START_DIR; // facing / moving direction
        this.target = step(START_TILE, START_DIR); // tile the head is moving into, null when stopped at a tile center
        this.progress = START_PROGRESS; // 0 to 1, how far the head is from body[0] to target
        this.grows = this.board.hasPellet(this.target); // whether reaching target adds a segment

        this.wantDir = null;
        this.wantName = null;
        this.wantTimer = 0;

        this.started = false;
        this.readyTimer = READY_TICKS;
        this.blockedTimer = 0;
        this.chompDistance = 0;

        this.death = null; // a DeathAnimation while he's dying

        this.blue = false; // from a power pellet: the next time he runs into himself, he bites instead of dying
        this.blueTimer = 0; // ticks since he turned blue, for the flash
        this.biteTimer = 0;
        this.pieces = [];
        this.powerChain = 0; // power pellets eaten while already blue, since he last bit
        this.bonusPoints = 0; // points from those, this level
        this.mouthShut = false; // the game shuts his mouth while bonus points are showing, so they're easy to read
    }

    get dead() {
        return this.death !== null;
    }

    // ----- Rules -----

    // Your body blocks you, except the tail tile, which moves out of the way as you move in
    isBodyBlocking(tile) {
        if (!this.occupied[tileIndex(tile)]) {
            return false;
        }
        const tail = this.body[this.body.length - 1];
        return !(this.body.length >= 3 && sameTile(tile, tail));
    }

    canEnter(tile) {
        if (this.board.isWall(tile)) {
            return false;
        }
        if (!this.isBodyBlocking(tile)) {
            return true;
        }
        // When blue he can bite into himself, just not the segment right behind his head
        return this.blue && !(this.body.length > 1 && sameTile(tile, this.body[1]));
    }

    hasSafeMove() {
        return Object.values(DIRS).some(d => this.canEnter(step(this.body[0], d)));
    }

    // ----- Input -----

    readInput() {
        const pressed = this.input.pressedDirection();
        if (pressed !== null) {
            this.wantDir = DIRS[pressed];
            this.wantName = pressed;
            this.wantTimer = this.input.bufferTicks();
        }

        if (this.wantDir !== null) {
            if (this.input.isHeld(this.wantName)) {
                this.wantTimer = KEY_BUFFER_TICKS;
            } else {
                this.wantTimer -= 1;
                if (this.wantTimer <= 0) {
                    this.clearInput();
                }
            }
        }
    }

    // Forget any remembered turn (after the game was paused, keys may have been let go without us seeing)
    clearInput() {
        this.wantDir = null;
        this.wantName = null;
        this.wantTimer = 0;
    }

    // ----- Movement -----

    setTarget(dir) {
        this.dir = dir;
        this.target = step(this.body[0], dir);
        if (this.isBodyBlocking(this.target)) {
            this.bite(this.target);
        }
        this.grows = this.board.hasPellet(this.target);
    }

    // Bites through his own body at tile: everything from there to the tail comes off
    bite(tile) {
        const index = this.body.findIndex(b => sameTile(b, tile));
        const cut = this.body.splice(index);
        for (const t of cut) {
            this.occupied[tileIndex(t)] = false;
        }
        this.pieces.push(new SeveredPiece(cut, this.effects, () => this.events.onPiecePop()));

        this.blue = false;
        this.powerChain = 0;
        this.biteTimer = BITE_CHOMP_TICKS;
        this.effects.shake();
        this.events.onBite();

        const c = center(tile);
        this.effects.burst(c.x, c.y, 10, [COLORS.flash, COLORS.blue]);
    }

    // Called while standing on a tile center: pick where to go next
    depart() {
        const options = [];
        if (this.wantDir !== null) {
            options.push(this.wantDir);
        }
        options.push(this.dir);

        for (const dir of options) {
            if (this.canEnter(step(this.body[0], dir))) {
                this.setTarget(dir);
                this.blockedTimer = 0;
                return true;
            }
        }

        this.target = null;
        this.progress = 0;

        // Boxed in with no way out is a crash right away. At a junction where straight ahead is your
        // body but another way is open, you get a moment to take it. Facing a wall is safe, you just wait.
        if (!this.hasSafeMove()) {
            this.die();
        } else if (this.isBodyBlocking(step(this.body[0], this.dir))) {
            this.blockedTimer += 1;
            if (this.blockedTimer > BLOCKED_GRACE_TICKS) {
                this.die();
            }
        } else {
            this.blockedTimer = 0;
        }
        return false;
    }

    arrive() {
        if (!this.grows) {
            const tail = this.body.pop();
            this.occupied[tileIndex(tail)] = false;
        }
        this.body.unshift(this.target);
        this.occupied[tileIndex(this.target)] = true;

        const eaten = this.board.eat(this.target);
        if (eaten !== EMPTY) {
            this.events.onEat(eaten);
        }
        if (eaten === POWER) {
            const c = center(this.target);
            if (this.blue) {
                // Already blue: like eating ghosts in Pac-Man, each one is worth double the last
                const points = BONUS_POINTS * Math.pow(2, this.powerChain);
                this.powerChain += 1;
                this.bonusPoints += points;
                this.events.onBonus(points, c.x, c.y);
            } else {
                this.blue = true;
                this.blueTimer = 0;
            }
            this.effects.burst(c.x, c.y, 10, [COLORS.blue, COLORS.pellet]);
        }

        this.target = null;
    }

    // Turning just after passing a tile center still counts, so corners don't feel sticky
    tryLateTurn() {
        if (this.wantDir === null || this.progress > LATE_TURN_WINDOW) {
            return;
        }
        if (this.wantDir.x === this.dir.x && this.wantDir.y === this.dir.y) {
            return;
        }

        const reversing = this.wantDir.x === -this.dir.x && this.wantDir.y === -this.dir.y;
        if (reversing) {
            return;
        }

        if (this.canEnter(step(this.body[0], this.wantDir))) {
            this.setTarget(this.wantDir);
        }
    }

    // With no tail you can turn around mid-tile, like Pac-Man
    tryReverse() {
        if (this.wantDir === null || this.body.length !== 1) {
            return;
        }
        if (this.wantDir.x !== -this.dir.x || this.wantDir.y !== -this.dir.y) {
            return;
        }

        const from = this.body[0];
        this.occupied[tileIndex(from)] = false;
        this.body[0] = this.target;
        this.occupied[tileIndex(this.target)] = true;

        this.dir = this.wantDir;
        this.target = from;
        this.grows = this.board.hasPellet(from);
        this.progress = 1 - this.progress;
    }

    updatePieces() {
        for (const piece of this.pieces) {
            piece.update();
        }
        this.pieces = this.pieces.filter(piece => !piece.isDone());
    }

    // speed is in tiles per tick
    update(speed) {
        if (this.biteTimer > 0) this.biteTimer -= 1;
        if (this.blue) this.blueTimer += 1;

        if (this.dead) {
            this.updateDying();
            return;
        }

        this.readInput();

        // Like Pac-Man, he waits through READY! and then starts moving left by himself. A direction held
        // or pressed during READY! is remembered, so he can turn or reverse straight away.
        if (!this.started) {
            this.readyTimer -= 1;
            if (this.readyTimer > 0) {
                return;
            }
            this.started = true;
        }

        if (this.target === null) {
            if (!this.depart()) {
                return;
            }
        } else {
            this.tryReverse();
            this.tryLateTurn();
        }

        this.progress += speed;
        this.chompDistance += speed * TILE;

        while (this.progress >= 1) {
            this.progress -= 1;
            this.arrive();
            if (this.dead || !this.depart()) {
                break;
            }
        }
    }

    // ----- Death -----

    die() {
        this.events.onDie();
        this.death = new DeathAnimation(this.body.length - 1);
        this.target = null;
        this.progress = 0;
    }

    updateDying() {
        const removed = this.death.update();
        if (this.death.timer === DEATH_FREEZE_TICKS) {
            this.events.onDeathSound(this.death.ticksUntilPop() / TICKS_PER_SECOND);
        }
        for (let i = 0; i < removed; i++) {
            const tail = this.body.pop();
            this.occupied[tileIndex(tail)] = false;
        }
        if (this.death.isOver()) {
            this.events.onDeathOver();
        }
    }

    // ----- Drawing -----

    // The centerline of the snake, from the head to the end of the tail, in pixels
    getPath() {
        const px = Math.floor(this.progress * TILE);
        const moving = this.target !== null;

        const start = center(this.body[0]);
        const head = moving ? {x: start.x + this.dir.x * px, y: start.y + this.dir.y * px} : start;
        const points = [head];

        points.push(...tilePath(this.body, head));

        // The tail end slides along with the head when it's about to give up a tile,
        // and slides back into him when he's dying
        let retract = 0;
        if (moving && !this.grows) {
            retract = px;
        } else if (this.dead) {
            retract = this.death.tailSlide();
        }
        if (retract > 0) {
            const end = points[points.length - 1];
            const before = points[points.length - 2];
            end.x += Math.sign(before.x - end.x) * retract;
            end.y += Math.sign(before.y - end.y) * retract;
        }

        return points;
    }

    // Splits the path into the neck (the first NECK_LENGTH pixels behind the head) and the rest
    splitNeck(points) {
        const neck = [points[0]];
        let travelled = 0;
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const b = points[i];
            const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
            if (travelled + length >= NECK_LENGTH) {
                const left = NECK_LENGTH - travelled;
                const split = {x: a.x + Math.sign(b.x - a.x) * left, y: a.y + Math.sign(b.y - a.y) * left};
                neck.push(split);
                return {neck, rest: [split, ...points.slice(i)]};
            }
            neck.push(b);
            travelled += length;
        }
        return {neck, rest: []};
    }

    mouthFrame() {
        if (!this.started || this.dead || this.mouthShut) {
            return 1;
        }
        // Big chomp: wide open, then snapped shut
        if (this.biteTimer > 0) {
            return this.biteTimer > BITE_CHOMP_TICKS / 2 ? 3 : 1;
        }
        if (this.target === null) {
            return STOPPED_MOUTH_FRAME;
        }
        return CHOMP_FRAMES[Math.floor(this.chompDistance / CHOMP_PIXELS) % CHOMP_FRAMES.length];
    }

    color() {
        if (this.dead && this.death.isFlashing()) {
            return COLORS.flash;
        }
        if (this.blue) {
            return Math.floor(this.blueTimer / BLUE_FLASH_TICKS) % 2 === 0 ? COLORS.blue : COLORS.flash;
        }
        return COLORS.snack;
    }

    drawFace(x, y, color) {
        const horizontal = this.dir.x !== 0;
        const name = "snack-man/snack-man-" + (horizontal ? "right" : "up") + "-" + this.mouthFrame() + ".png";
        const flipX = this.dir.x < 0;
        const flipY = this.dir.y > 0;
        // The sprites are already yellow, so only other colors need recoloring
        if (color === COLORS.snack) {
            MDog.Draw.image(name, x - 6, y - 6, {flipX: flipX, flipY: flipY});
        } else {
            drawRecolored(name, x - 6, y - 6, color, flipX, flipY);
        }
    }

    // Snack Man is drawn in layers around the pellets: body and a black mouth first, then the
    // pellets, then the face, so pellets show up inside his open mouth as he eats them.
    drawUnderPellets(tick) {
        const points = this.getPath();
        this.points = points;

        this.offsets = tunnelOffsets(points);
        const color = this.color();

        // A black disc behind the face fills his open mouth. His neck goes under it, so it never
        // shows inside his mouth. The rest of his body goes over it, so if his own tail is right
        // in front of him, you see the tail in his mouth instead of a black outline.
        if (this.inDeathFinale()) {
            this.drawPieces();
            return; // only the head is left, and drawOverPellets handles it
        }

        const {neck, rest} = this.splitNeck(points);
        for (const offsetX of this.offsets) {
            drawTrail(neck, offsetX, color, rest.length < 2);
        }
        for (const offsetX of this.offsets) {
            circle(points[0].x + offsetX, points[0].y, COLORS.background);
        }
        this.drawPieces();
        for (const offsetX of this.offsets) {
            drawTrail(rest, offsetX, color, true);
            drawInnerCorners(points, offsetX, color);
        }
    }

    // Bitten-off pieces go over his black mouth disc, so he looks like he's eating them,
    // but under the rest of his body, so his new trail covers them as he moves over them
    drawPieces() {
        for (const piece of this.pieces) {
            piece.draw();
        }
    }

    drawOverPellets(tick) {
        const head = this.points[0];
        for (const offsetX of this.offsets) {
            if (this.inDeathFinale()) {
                this.death.drawFinale(head.x + offsetX, head.y, Math.atan2(this.dir.y, this.dir.x));
            } else {
                this.drawFace(head.x + offsetX, head.y, this.color());
            }
        }
    }

    // Once his tail is all the way in, only the spinning head is drawn
    inDeathFinale() {
        return this.dead && this.death.finaleFrame() >= 0;
    }
}

// ---------- Title logo ----------

// "SNACK MAN" in big blocky letters for the title screen (the regular font is only 5 pixels tall)
const LOGO_LETTERS = {
    S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
    K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    " ": ["...", "...", "...", "...", "...", "...", "..."]
};
const LOGO_SCALE = 4; // screen pixels per logo pixel
const LOGO_GAP = 1; // logo pixels between letters

function logoWidth(text) {
    let width = 0;
    for (const letter of text) {
        width += LOGO_LETTERS[letter][0].length + LOGO_GAP;
    }
    return (width - LOGO_GAP) * LOGO_SCALE;
}

// The logo's filled pixels, worked out once per text: {cells: [{x, y}], width}, in logo pixels
const logoCache = new Map();

function logoCells(text) {
    if (logoCache.has(text)) {
        return logoCache.get(text);
    }
    const cells = [];
    let left = 0;
    for (const char of text) {
        const rows = LOGO_LETTERS[char];
        rows.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                if (row[x] === "#") {
                    cells.push({x: left + x, y: y});
                }
            }
        });
        left += rows[0].length + LOGO_GAP;
    }
    const logo = {cells: cells, width: left - LOGO_GAP};
    logoCache.set(text, logo);
    return logo;
}

// An arcade-style gradient down the letters, from pale yellow at the top to deep orange at the bottom
const LOGO_ROW_COLORS = ["#fff7b0", "#fff04a", "#ffe000", "#ffc400", "#ffa600", "#ff8400", "#ff6000"];
const LOGO_SHADOW_COLOR = "#7a1500";

// Draws the logo with its top middle at (x, y), with a drop shadow
function drawLogo(text, x, y) {
    const logo = logoCells(text);
    const left = Math.floor(x - logo.width * LOGO_SCALE / 2);
    const shadow = LOGO_SCALE / 2;
    for (const cell of logo.cells) {
        MDog.Draw.rectangleFill(left + cell.x * LOGO_SCALE + shadow, y + cell.y * LOGO_SCALE + shadow, LOGO_SCALE, LOGO_SCALE, LOGO_SHADOW_COLOR);
    }
    for (const cell of logo.cells) {
        MDog.Draw.rectangleFill(left + cell.x * LOGO_SCALE, y + cell.y * LOGO_SCALE, LOGO_SCALE, LOGO_SCALE, LOGO_ROW_COLORS[cell.y]);
    }
}

// ---------- Game ----------

function loadBest() {
    try {
        return parseInt(localStorage.getItem(BEST_SCORE_KEY) ?? "0") || 0;
    } catch (e) {
        return 0;
    }
}

function saveBest(best) {
    try {
        localStorage.setItem(BEST_SCORE_KEY, "" + best);
    } catch (e) {
        // No storage (private window, etc.): the best score just won't stick around
    }
}

const TITLE_LINES = [
    {y: 52, text: "EAT PELLETS TO GROW LONGER.", color: "text"},
    {y: 64, text: "YOUR SCORE IS HOW LONG YOU ARE.", color: "text"},
    {y: 76, text: "DON'T RUN INTO YOURSELF!", color: "text"},
    {y: 102, text: "POWER PELLETS TURN YOU BLUE.", color: "label"},
    {y: 114, text: "WHILE YOU'RE BLUE, BITE YOURSELF", color: "label"},
    {y: 126, text: "TO CUT OFF YOUR TAIL...", color: "label"},
    {y: 138, text: "BUT YOU LOSE THE POINTS YOU BITE OFF!", color: "loss"},
    {y: 164, text: "MORE POWER PELLETS WHILE BLUE:", color: "label"},
    {y: 176, text: "200, 400, 800...", color: "bonus"}
];

// On-screen hints, for whichever the player is using
const HINTS = {
    keyboard: {
        move: "ARROWS OR WASD TO MOVE",
        pause: "P OR ESC TO PAUSE - M TO MUTE",
        start: "PRESS ENTER TO START",
        hud: "P OR ESC TO PAUSE",
        menu: "ARROWS TO PICK, ENTER TO CHOOSE",
        help: "PRESS H FOR HOW TO PLAY",
        back: "PRESS ENTER TO GO BACK",
        save: "ENTER TO SAVE - ESC TO SKIP",
        retry: "ENTER: TRY AGAIN - ESC: SKIP"
    },
    touch: {
        move: "SWIPE TO MOVE",
        pause: "PAUSE BUTTON IS AT THE TOP",
        start: "TAP TO START",
        hud: "", // the pause button speaks for itself
        menu: "TAP AN OPTION",
        help: "HOW TO PLAY", // the button's label
        back: "TAP TO GO BACK",
        save: "", // buttons instead
        retry: ""
    }
};

// On touch screens, "how to play" on the title screen is a button (in maze pixels)
const HELP_BUTTON = {x: MAZE_WIDTH / 2 - 45, y: 256, width: 90, height: 17};

// "1ST", "2ND", "3RD", "4TH"...
function ordinal(n) {
    const tens = n % 100;
    if (tens >= 11 && tens <= 13) return n + "TH";
    return n + (["TH", "ST", "ND", "RD"][n % 10] ?? "TH");
}

// The pause button shown at the top of the screen on touch screens (in maze pixels)
const PAUSE_BUTTON = {x: MAZE_WIDTH / 2 - 8, y: -32, size: 16};
const BUTTON_COLORS = {
    fill: "#0d0d55",
    border: "#2121ff",
    highlight: "#4a4aff", // the lit top edge
    shadow: "#05052a" // the band underneath, so it looks raised
};

// An arcade-style button: dark blue, a rounded blue border, a lit top edge and a shadow underneath.
// label is optional, and is drawn in the middle.
function drawButton(x, y, width, height, label) {
    const c = BUTTON_COLORS;
    MDog.Draw.rectangleFill(x + 1, y + height, width - 2, 2, c.shadow);
    MDog.Draw.rectangleFill(x + 1, y + 1, width - 2, height - 2, c.fill);
    // Border, leaving the corner pixels out so the corners look rounded
    MDog.Draw.rectangleFill(x + 1, y, width - 2, 1, c.border);
    MDog.Draw.rectangleFill(x + 1, y + height - 1, width - 2, 1, c.border);
    MDog.Draw.rectangleFill(x, y + 1, 1, height - 2, c.border);
    MDog.Draw.rectangleFill(x + width - 1, y + 1, 1, height - 2, c.border);
    MDog.Draw.rectangleFill(x + 2, y + 1, width - 4, 1, c.highlight);
    if (label !== undefined && label !== "") {
        MDog.Draw.textImage(label, x + Math.floor(width / 2), y + Math.floor(height / 2), COLORS.text, "fonts/marsfont.png", {alignX: "center", alignY: "center"});
    }
}

const PAUSE_BUTTON_REACH = 12; // taps this far outside the button still count, since fingers are big

// Phone vibration patterns, in milliseconds (vibrate, pause, vibrate, ...)
const VIBRATIONS = {
    bite: [35],
    bonus: [25, 40, 25],
    death: [60, 50, 60, 50, 180],
    levelClear: [40, 60, 40, 60, 40]
};

// The vibration option only shows on phones that can vibrate
const PAUSE_OPTIONS = ["RESUME", "RESTART", "MUTE", "VIBRATION", "TITLE SCREEN"];

function canVibrate() {
    return navigator.vibrate !== undefined;
}

function loadVibrationAllowed() {
    try {
        return localStorage.getItem(VIBRATION_KEY) !== "off";
    } catch (e) {
        return true;
    }
}

const game = {
    state: "title", // "title", "howto", "playing", "paused" or "entry" (typing a name for the scoreboard)
    tick: 0,
    level: 1,
    board: new Board(),
    snackMan: null,
    effects: new Effects(),
    controls: new Controls(),
    sound: new Sound(),
    scoreboard: new Scoreboard(),
    nameInput: new NameInput(),
    entry: null, // while typing a name: {mode, score, message, takenName, rank, existing}
    clearTimer: 0,
    freezeTimer: 0, // while bonus points are showing, everything stops
    bonusPopup: null,
    pauseSelection: 0,
    best: loadBest(),
    bankedScore: 0, // score from levels already cleared this run
    finalScore: null, // set when a level is over, so the score stops changing
    newBest: false,
    vibrationAllowed: loadVibrationAllowed(),
    debugRun: false, // a level was skipped this run, so it can't set a best score

    // Back to level 1 with a fresh board and no score (after dying, or choosing RESTART)
    restart() {
        this.level = 1;
        this.bankedScore = 0;
        this.debugRun = false;
        this.startLevel();
    },

    startLevel() {
        this.clearTimer = 0;
        this.freezeTimer = 0;
        this.bonusPopup = null;
        this.effects.clear();
        this.finalScore = null;
        this.newBest = false;
        this.board.reset(this.level);
        this.snackMan.reset();
    },

    startGame() {
        this.state = "playing";
        this.restart();
        this.sound.start();
        this.scoreboard.refresh(); // so it's up to date when the run ends
    },

    // The run is over (the death animation finished). If the score makes the online top 10, ask for a name.
    endOfRun() {
        const score = this.finalScore ?? 0;
        if (this.debugRun || !this.scoreboard.qualifies(score)) {
            this.restart();
            return;
        }

        // This device's name is already on the board with a score at least this good: there's nothing to
        // save, so it's just back to the title screen
        const myName = this.scoreboard.myName;
        const mine = myName ? this.scoreboard.find(myName) : null;
        if (mine !== null && mine.score >= score) {
            this.goToTitle();
            return;
        }

        this.state = "entry";
        this.sound.setBackground(null);
        const rank = this.scoreboard.entries.filter(entry => entry.score >= score).length + 1;
        this.entry = {mode: "name", score: score, rank: rank, message: null, takenName: null, existing: null};
        this.nameInput.open(myName ?? "");
    },

    finishEntry() {
        this.nameInput.close();
        this.entry = null;
        this.goToTitle();
    },

    // Enter (or "done" on a phone) in the name box
    submitName() {
        const entry = this.entry;
        const name = this.nameInput.value().trim();
        const problem = this.scoreboard.nameProblem(name);
        if (problem !== null) {
            entry.message = problem;
            return;
        }

        // Pressing Enter again on a name that's taken means "yes, that's me": their better score stays
        if (entry.mode === "taken" && name === entry.takenName) {
            this.scoreboard.rememberName(name);
            this.scoreboard.highlight = name;
            this.finishEntry();
            return;
        }

        // The name already has a better score: explain, and let them type a different name
        const existing = this.scoreboard.find(name);
        if (existing !== null && existing.score >= entry.score) {
            entry.mode = "taken";
            entry.takenName = name;
            entry.existing = existing;
            entry.message = null;
            return;
        }

        this.saveScore(name);
    },

    async saveScore(name) {
        const entry = this.entry;
        entry.mode = "saving";
        entry.message = null;
        this.nameInput.close();
        try {
            const result = await this.scoreboard.submit(name, entry.score);
            if (this.entry !== entry) {
                return;
            }
            if (result.improved) {
                this.finishEntry();
            } else {
                // Someone saved a better score under this name since the board was loaded
                entry.mode = "taken";
                entry.takenName = result.name;
                entry.existing = this.scoreboard.find(result.name) ?? {rank: null, score: result.score};
                this.nameInput.open(result.name);
            }
        } catch (e) {
            console.error(e);
            if (this.entry === entry) {
                entry.mode = "error";
                entry.takenName = name;
            }
        }
    },

    // Buttons used on touch screens in the name box (in maze pixels)
    entryButtons() {
        const box = this.entryLayout();
        const y = box.y + box.height - 25;
        const labels = {name: ["SAVE", "SKIP"], taken: ["OK", "SKIP"], error: ["RETRY", "SKIP"]}[this.entry.mode];
        if (labels === undefined) {
            return [];
        }
        const width = 70;
        const gap = 12;
        const left = Math.floor(MAZE_WIDTH / 2 - width - gap / 2);
        return labels.map((label, i) => ({label: label, x: left + i * (width + gap), y: y, width: width, height: 17}));
    },

    tappedButton() {
        const tap = this.tapInMaze();
        if (tap === null) {
            return null;
        }
        const button = this.entryButtons().find(b => tap.x >= b.x && tap.x < b.x + b.width && tap.y >= b.y - 4 && tap.y < b.y + b.height + 4);
        return button === undefined ? null : button.label;
    },

    updateEntry() {
        const entry = this.entry;
        const button = this.tappedButton();
        const enter = this.controls.pressed("enter");
        const cancel = this.controls.pressed("cancel");

        if (!this.controls.isTouch()) {
            this.nameInput.keepFocus();
        }

        if (entry.mode === "name" || entry.mode === "taken") {
            if (this.nameInput.takeSubmit() || button === "SAVE" || button === "OK") {
                this.submitName();
            } else if (cancel || button === "SKIP") {
                this.finishEntry();
            }
        } else if (entry.mode === "error") {
            if (enter || button === "RETRY") {
                this.saveScore(entry.takenName);
            } else if (cancel || button === "SKIP") {
                this.finishEntry();
            }
        }
    },

    // selected is the option to start on (RESUME if not given)
    pause(selected) {
        this.state = "paused";
        this.pauseSelection = Math.max(0, this.pauseOptions().indexOf(selected));
        this.sound.setPaused(true);
    },

    resume() {
        this.state = "playing";
        this.snackMan.clearInput();
        this.sound.setPaused(false);
    },

    goToTitle() {
        this.state = "title";
        this.scoreboard.refresh();
        this.sound.stopAll();
        this.sound.setPaused(false);
    },

    hints() {
        return this.controls.isTouch() ? HINTS.touch : HINTS.keyboard;
    },

    speed() {
        return SPEED * Math.min(MAX_SPEED_MULTIPLIER, 1 + SPEED_PER_LEVEL * (this.level - 1));
    },

    // Your score is what you banked on earlier levels, plus bonus points, plus how long you are: every
    // segment is a pellet you ate. Bitten-off segments still count until they pop, so the score drains away as they do.
    getScore() {
        if (this.finalScore !== null) {
            return this.finalScore;
        }
        const bitten = this.snackMan.pieces.reduce((sum, piece) => sum + piece.tiles.length, 0);
        return this.bankedScore + this.snackMan.bonusPoints + (this.snackMan.body.length - 1 + bitten) * PELLET_POINTS;
    },

    // The level is over (he died, or cleared the board). Anything you bit off is already lost,
    // even if it hasn't finished popping. Only a death can set a best score: a run has to be played out
    // to the end, so restarting, quitting or closing the tab with a big score doesn't count.
    endRound(died) {
        this.finalScore = this.bankedScore + this.snackMan.bonusPoints + (this.snackMan.body.length - 1) * PELLET_POINTS;
        if (died && this.finalScore > this.best && !this.debugRun) {
            this.best = this.finalScore;
            this.newBest = true;
            saveBest(this.best);
        }
    },

    isClearing() {
        return this.board.pelletsLeft === 0;
    },

    // Buzzes the phone. Only on touch screens, only where the browser can (iPhones can't),
    // and only if the player hasn't turned it off.
    vibrate(pattern) {
        if (this.controls.isTouch() && canVibrate() && this.vibrationAllowed) {
            navigator.vibrate(pattern);
        }
    },

    toggleVibration() {
        this.vibrationAllowed = !this.vibrationAllowed;
        try {
            localStorage.setItem(VIBRATION_KEY, this.vibrationAllowed ? "on" : "off");
        } catch (e) {
            // No storage: the setting just won't stick around
        }
    },

    // The options in the pause menu right now
    pauseOptions() {
        const showVibration = this.controls.isTouch() && canVibrate();
        return PAUSE_OPTIONS.filter(option => option !== "VIBRATION" || showVibration);
    },

    pauseOptionLabel(option) {
        if (option === "MUTE") {
            return this.sound.muted ? "UNMUTE" : "MUTE";
        }
        if (option === "VIBRATION") {
            return this.vibrationAllowed ? "TURN VIBRATION OFF" : "TURN VIBRATION ON";
        }
        return option;
    },

    // Where the pause menu and its options are, for drawing it and for tapping options
    pauseMenuLayout() {
        const width = 170;
        const height = 54 + (this.pauseOptions().length - 1) * 11;
        // Whole pixels only: text drawn at a half pixel comes out blurry
        const x = Math.floor(MAZE_WIDTH / 2 - width / 2);
        const y = Math.floor(MAZE_HEIGHT / 2 - height / 2);
        return {x, y, width, height, optionY: i => y + 32 + i * 11, optionHeight: 11};
    },

    // A tap from the controls, moved into maze pixels
    tapInMaze() {
        const tap = this.controls.tapPosition();
        return tap === null ? null : {x: tap.x - MAZE_X, y: tap.y - MAZE_Y};
    },

    tappedHelpButton() {
        if (!this.controls.isTouch()) {
            return false;
        }
        const tap = this.tapInMaze();
        const b = HELP_BUTTON;
        return tap !== null && tap.x >= b.x && tap.x < b.x + b.width && tap.y >= b.y - 4 && tap.y < b.y + b.height + 4;
    },

    tappedPauseButton() {
        const tap = this.tapInMaze();
        if (tap === null) {
            return false;
        }
        const b = PAUSE_BUTTON;
        const reach = PAUSE_BUTTON_REACH;
        return tap.x >= b.x - reach && tap.x < b.x + b.size + reach && tap.y >= b.y - reach && tap.y < b.y + b.size + reach;
    },

    showBonus(points, x, y) {
        this.freezeTimer = BONUS_FREEZE_TICKS;
        this.bonusPopup = {text: "" + points, x: x, y: y};
        this.snackMan.mouthShut = true;
        this.sound.bonus();
        this.vibrate(VIBRATIONS.bonus);
    },

    update() {
        this.tick += 1;
        this.controls.update();

        // While typing a name, letters are for the name, not for shortcuts like M to mute
        if (this.state === "entry") {
            this.updateEntry();
            return;
        }

        if (this.controls.mutePressed()) {
            this.sound.toggleMute();
        }

        if (this.state === "title") {
            if (this.controls.pressed("help") || this.tappedHelpButton()) {
                this.state = "howto";
            } else if (this.controls.confirmPressed() || this.controls.tapPosition() !== null) {
                this.startGame();
            }
            return;
        }

        if (this.state === "howto") {
            if (this.controls.confirmPressed() || this.controls.pressed("help") || this.controls.pressed("cancel") || this.controls.tapPosition() !== null) {
                this.state = "title";
            }
            return;
        }

        if (this.state === "paused") {
            this.updatePauseMenu();
            return;
        }

        if (this.controls.pausePressed() || this.tappedPauseButton()) {
            this.pause();
            return;
        }
        // R doesn't restart straight away, so a stray key press can't throw away a run
        if (this.controls.restartPressed()) {
            this.pause("RESTART");
            return;
        }
        // For testing: double tap L to skip straight to the next level. Pellets aren't eaten, so your
        // score doesn't change, and the rest of the run can't set a best score.
        if (this.controls.skipLevelPressed() && !this.snackMan.dead && !this.isClearing()) {
            this.debugRun = true;
            this.snackMan.pieces = []; // bitten-off pieces would otherwise hold the level clear until they pop
            this.board.clearAll();
        }

        this.effects.update();

        if (this.freezeTimer > 0) {
            this.freezeTimer -= 1;
            if (this.freezeTimer === 0) {
                this.bonusPopup = null;
                this.snackMan.mouthShut = false;
            }
        } else {
            this.snackMan.updatePieces();
            if (this.isClearing()) {
                this.updateClear();
            } else {
                this.snackMan.update(this.speed());
            }
        }

        const frightened = this.snackMan.blue && !this.snackMan.dead && !this.isClearing() && this.freezeTimer === 0;
        const droneOn = this.snackMan.started && !this.snackMan.dead && !this.isClearing() && this.freezeTimer === 0;
        this.sound.setBackground(frightened ? "frightened" : (droneOn ? "siren" : null), 1 - this.board.pelletsLeft / this.board.totalPellets);
    },

    updatePauseMenu() {
        if (this.controls.pausePressed()) {
            this.resume();
            return;
        }

        const options = this.pauseOptions();
        this.pauseSelection = Math.min(this.pauseSelection, options.length - 1);
        const direction = this.controls.pressedDirection();
        if (direction === "up") {
            this.pauseSelection = (this.pauseSelection + options.length - 1) % options.length;
        } else if (direction === "down") {
            this.pauseSelection = (this.pauseSelection + 1) % options.length;
        }

        // On a touch screen, tapping an option picks it straight away
        const tap = this.tapInMaze();
        let chosen = this.controls.confirmPressed();
        if (tap !== null) {
            const menu = this.pauseMenuLayout();
            const insideX = tap.x >= menu.x && tap.x < menu.x + menu.width;
            options.forEach((option, i) => {
                const top = menu.optionY(i) - menu.optionHeight / 2;
                if (insideX && tap.y >= top && tap.y < top + menu.optionHeight) {
                    this.pauseSelection = i;
                    chosen = true;
                }
            });
        }

        if (chosen) {
            const choice = options[this.pauseSelection];
            if (choice === "RESUME") {
                this.resume();
            } else if (choice === "RESTART") {
                this.resume();
                this.sound.stopAll();
                this.restart();
            } else if (choice === "MUTE") {
                this.sound.toggleMute();
            } else if (choice === "VIBRATION") {
                this.toggleVibration();
                this.vibrate(VIBRATIONS.bite); // a little buzz so you can feel it's back on
            } else {
                this.goToTitle();
            }
        }
    },

    // Board cleared: freeze, flash the maze like Pac-Man, then on to the next (faster) level
    updateClear() {
        // Let any bitten-off piece finish popping first, so the final score is settled
        if (this.finalScore === null) {
            if (this.snackMan.pieces.length > 0) {
                return;
            }
            this.endRound(false);
            this.sound.levelClear();
            this.vibrate(VIBRATIONS.levelClear);
        }
        this.clearTimer += 1;
        if (this.clearTimer >= CLEAR_PAUSE_TICKS + CLEAR_FLASH_TICKS * CLEAR_FLASHES) {
            this.level += 1;
            this.bankedScore = this.finalScore;
            this.startLevel();
        }
    },

    mazeFlashing() {
        if (!this.isClearing() || this.clearTimer < CLEAR_PAUSE_TICKS) {
            return false;
        }
        return Math.floor((this.clearTimer - CLEAR_PAUSE_TICKS) / CLEAR_FLASH_TICKS) % 2 === 0;
    },

    draw() {
        if (this.state === "title") {
            this.drawTitle();
            return;
        }
        if (this.state === "howto") {
            this.drawHowTo();
            return;
        }

        const shake = this.effects.shakeOffset();
        MDog.Draw.translate(MAZE_X + shake.x, MAZE_Y + shake.y);

        MDog.Draw.clear({color: COLORS.background});
        if (this.mazeFlashing()) {
            drawRecolored("snack-man/map.png", 0, 0, COLORS.flash, false, false);
        } else {
            MDog.Draw.image("snack-man/map.png", 0, 0);
        }

        this.snackMan.drawUnderPellets(this.tick);
        this.board.drawPellets(this.tick);
        this.snackMan.drawOverPellets(this.tick);
        this.effects.draw();

        if (this.bonusPopup !== null) {
            const popup = this.bonusPopup;
            MDog.Draw.textImage(popup.text, popup.x, popup.y, COLORS.bonus, "fonts/marsfont.png", {alignX: "center", alignY: "center"});
        }

        // Hide anything poking out of the tunnel
        const screenHeight = MDog.Draw.getScreenHeightInArtPixels();
        MDog.Draw.rectangleFill(-MAZE_X - SHAKE_AMOUNT, -MAZE_Y - SHAKE_AMOUNT, MAZE_X + SHAKE_AMOUNT, screenHeight + SHAKE_AMOUNT * 2, COLORS.background);
        MDog.Draw.rectangleFill(MAZE_WIDTH, -MAZE_Y - SHAKE_AMOUNT, MAZE_X + SHAKE_AMOUNT, screenHeight + SHAKE_AMOUNT * 2, COLORS.background);

        MDog.Draw.translate(MAZE_X, MAZE_Y);
        this.drawHud();

        if (this.state === "paused") {
            this.drawPauseMenu();
        }
        if (this.state === "entry") {
            this.drawEntry();
        }
    },

    drawTitle() {
        const font = "fonts/marsfont.png";
        const middle = MAZE_WIDTH / 2;
        MDog.Draw.translate(MAZE_X, MAZE_Y);
        MDog.Draw.clear({color: COLORS.background});

        // Three groups (title, scores, what to do next) with even space between them, and even margins
        // above and below. The screen runs from -40 to 288 here.
        drawLogo("SNACK MAN", middle, -22);
        MDog.Draw.textImage("BY MILO KESTELOOT", middle, 16, COLORS.label, font, {alignX: "center", alignY: "center"});
        this.drawScoreboard(middle, 53);

        MDog.Draw.textImage("YOUR BEST: " + this.best, middle, 211, COLORS.label, font, {alignX: "center", alignY: "center"});

        const hints = this.hints();
        const touch = this.controls.isTouch();
        if (touch) {
            this.drawHelpButton();
        } else {
            MDog.Draw.textImage(hints.help, middle, 268, COLORS.dim, font, {alignX: "center", alignY: "center"});
        }
        // On touch screens the start message moves up a little, to leave room for the button under it
        if (Math.floor(this.tick / 40) % 2 === 0) {
            MDog.Draw.textImage(hints.start, middle, touch ? 238 : 252, COLORS.snack, font, {size: 2, alignX: "center", alignY: "center"});
        }
    },

    // The online top 10, in a double-walled box like the maze
    drawScoreboard(middle, top) {
        const font = "fonts/marsfont.png";
        const width = 184;
        const height = 148;
        const x = middle - width / 2;
        MDog.Draw.rectangle(x, top, width, height, COLORS.wall);
        MDog.Draw.rectangle(x + 2, top + 2, width - 4, height - 4, COLORS.wall);
        MDog.Draw.textImage("HIGH SCORES", middle, top + 11, COLORS.snack, font, {size: 2, alignX: "center", alignY: "center"});

        const board = this.scoreboard;
        const firstRow = top + 30;
        if (board.status !== "ready" || board.entries.length === 0) {
            const lines = board.status === "loading" ? ["LOADING SCORES..."]
                : board.status === "offline" ? ["SCOREBOARD OFFLINE"]
                : ["NO SCORES YET.", "BE THE FIRST!"];
            lines.forEach((line, i) => {
                MDog.Draw.textImage(line, middle, firstRow + 40 + i * 12, COLORS.dim, font, {alignX: "center", alignY: "center"});
            });
            return;
        }

        board.entries.forEach((entry, i) => {
            const y = firstRow + i * 11;
            const justSaved = entry.name === board.highlight;
            const mine = entry.name === board.myName;
            let color = mine ? COLORS.snack : COLORS.text;
            if (justSaved && Math.floor(this.tick / 12) % 2 === 0) {
                color = COLORS.bonus;
            }
            MDog.Draw.textImage((i + 1) + ".", x + 28, y, COLORS.label, font, {alignX: "right", alignY: "center"});
            MDog.Draw.textImage(entry.name, x + 34, y, color, font, {alignY: "center"});
            // Same gap from the right wall as "1." has from the left wall
            MDog.Draw.textImage("" + entry.score, x + width - 21, y, color, font, {alignX: "right", alignY: "center"});
        });
    },

    drawHelpButton() {
        const b = HELP_BUTTON;
        drawButton(b.x, b.y, b.width, b.height, this.hints().help);
    },

    drawHowTo() {
        const font = "fonts/marsfont.png";
        const middle = MAZE_WIDTH / 2;
        MDog.Draw.translate(MAZE_X, MAZE_Y);
        MDog.Draw.clear({color: COLORS.background});

        drawLogo("SNACK MAN", middle, -22);
        MDog.Draw.textImage("HOW TO PLAY", middle, 28, COLORS.snack, font, {size: 2, alignX: "center", alignY: "center"});

        for (const line of TITLE_LINES) {
            MDog.Draw.textImage(line.text, middle, line.y, COLORS[line.color], font, {alignX: "center", alignY: "center"});
        }

        const hints = this.hints();
        MDog.Draw.textImage(hints.move, middle, 208, COLORS.dim, font, {alignX: "center", alignY: "center"});
        MDog.Draw.textImage(hints.pause, middle, 220, COLORS.dim, font, {alignX: "center", alignY: "center"});
        if (Math.floor(this.tick / 40) % 2 === 0) {
            MDog.Draw.textImage(hints.back, middle, 256, COLORS.snack, font, {alignX: "center", alignY: "center"});
        }
    },

    entryLayout() {
        const width = 208;
        const height = 150;
        // Whole pixels only: text drawn at a half pixel comes out blurry
        return {x: Math.floor(MAZE_WIDTH / 2 - width / 2), y: Math.floor(MAZE_HEIGHT / 2 - height / 2), width: width, height: height};
    },

    // The box for typing a name onto the scoreboard, over the frozen maze
    drawEntry() {
        const font = "fonts/marsfont.png";
        const middle = MAZE_WIDTH / 2;
        const entry = this.entry;
        const {x, y, width, height} = this.entryLayout();
        const text = (line, row, color, size) => MDog.Draw.textImage(line, middle, y + row, color, font, {size: size ?? 1, alignX: "center", alignY: "center"});

        MDog.Draw.rectangleFill(x, y, width, height, COLORS.background);
        MDog.Draw.rectangle(x, y, width, height, COLORS.wall);
        MDog.Draw.rectangle(x + 2, y + 2, width - 4, height - 4, COLORS.wall);

        text("NEW HIGH SCORE!", 14, COLORS.snack, 2);
        text("" + entry.score, 34, COLORS.text, 2);

        if (entry.mode === "saving") {
            text("SAVING...", 80, COLORS.label);
        } else if (entry.mode === "error") {
            text("COULDN'T SAVE YOUR SCORE.", 64, COLORS.loss);
            text("CHECK YOUR CONNECTION.", 76, COLORS.label);
            text(this.hints().retry, height - 14, COLORS.dim);
        } else {
            if (entry.mode === "taken") {
                const place = entry.existing.rank !== null ? " IS ALREADY " + ordinal(entry.existing.rank) + " PLACE" : " IS ALREADY ON THE BOARD";
                text(entry.takenName + place, 48, COLORS.label);
                text("WITH A BETTER SCORE: " + entry.existing.score + ".", 58, COLORS.label);
                text("NOT YOU? TYPE A NEW NAME.", 68, COLORS.text);
            } else {
                text("THAT'S " + ordinal(entry.rank) + " PLACE! TYPE YOUR NAME:", 56, COLORS.label);
            }
            this.drawNameField(middle, y + 82);
            if (entry.message !== null) {
                text(entry.message, 104, COLORS.loss);
            } else if (entry.mode === "taken") {
                text("OR ENTER TO KEEP IT AS IT IS.", 104, COLORS.dim);
            }
            text(this.hints().save, height - 14, COLORS.dim);
        }

        if (this.controls.isTouch()) {
            for (const button of this.entryButtons()) {
                drawButton(button.x, button.y, button.width, button.height, button.label);
            }
        }
    },

    // The name being typed, in a box, with a blinking cursor
    drawNameField(middle, centerY) {
        const font = "fonts/marsfont.png";
        const width = 120;
        const height = 17;
        const x = middle - width / 2;
        const y = centerY - Math.floor(height / 2);
        MDog.Draw.rectangle(x, y, width, height, COLORS.wall);

        const name = this.nameInput.value();
        const cursorOn = Math.floor(this.tick / 40) % 2 === 0;
        if (name === "" && this.controls.isTouch() && !this.nameInput.hasFocus()) {
            MDog.Draw.textImage("TAP HERE TO TYPE", middle, centerY, COLORS.dim, font, {alignX: "center", alignY: "center"});
            return;
        }
        // Each letter is 5 pixels wide at size 2, with a pixel between, so the text is centered by hand
        const textWidth = name.length === 0 ? 0 : name.length * 10 - 2;
        const left = Math.floor(middle - textWidth / 2);
        if (name !== "") {
            MDog.Draw.textImage(name, left, centerY, COLORS.snack, font, {size: 2, alignY: "center"});
        }
        if (cursorOn) {
            MDog.Draw.rectangleFill(left + textWidth + 2, centerY - 4, 2, 10, COLORS.snack);
        }
    },

    drawHud() {
        const font = "fonts/marsfont.png";
        const top = -30;

        // Score on the left, best on the right
        const draining = this.snackMan.pieces.length > 0 && this.finalScore === null;
        MDog.Draw.textImage("SCORE", 0, top, COLORS.label, font);
        MDog.Draw.textImage("" + this.getScore(), 0, top + 9, draining ? COLORS.scoreDrain : COLORS.text, font, {size: 2});

        const bestFlashing = this.newBest && Math.floor(this.tick / 12) % 2 === 0;
        MDog.Draw.textImage("BEST", MAZE_WIDTH, top, COLORS.label, font, {alignX: "right"});
        MDog.Draw.textImage("" + this.best, MAZE_WIDTH, top + 9, bestFlashing ? COLORS.snack : COLORS.text, font, {size: 2, alignX: "right"});

        MDog.Draw.textImage("LEVEL " + this.level + (this.debugRun ? " - DEBUG" : ""), 0, MAZE_HEIGHT + 8, COLORS.label, font);
        const hint = [this.sound.muted ? "MUTED" : "", this.hints().hud].filter(text => text !== "").join(" - ");
        if (hint !== "") {
            MDog.Draw.textImage(hint, MAZE_WIDTH, MAZE_HEIGHT + 8, COLORS.dim, font, {alignX: "right"});
        }
        if (this.controls.isTouch() && this.state === "playing") {
            this.drawPauseButton();
        }

        this.drawMessage();
    },

    // Pac-Man style messages, in the open row under the middle box
    drawMessage() {
        let text = null;
        let color = COLORS.snack;
        if (this.isClearing() && this.finalScore !== null) {
            text = "LEVEL CLEAR!";
            color = Math.floor(this.tick / 12) % 2 === 0 ? COLORS.snack : COLORS.text;
        } else if (this.snackMan.dead && this.newBest) {
            text = "NEW BEST!";
            color = Math.floor(this.tick / 12) % 2 === 0 ? COLORS.snack : COLORS.text;
        } else if (!this.snackMan.started && !this.snackMan.dead) {
            text = this.level > 1 ? "LEVEL " + this.level : "READY!";
        }
        if (text === null) {
            return;
        }
        MDog.Draw.textImage(text, MESSAGE_X, MESSAGE_Y, color, "fonts/marsfont.png", {alignX: "center", alignY: "center"});
    },

    // A button with two bars on it
    drawPauseButton() {
        const b = PAUSE_BUTTON;
        drawButton(b.x, b.y, b.size, b.size);
        MDog.Draw.rectangleFill(b.x + 5, b.y + 4, 2, b.size - 8, COLORS.text);
        MDog.Draw.rectangleFill(b.x + b.size - 7, b.y + 4, 2, b.size - 8, COLORS.text);
    },

    drawPauseMenu() {
        const font = "fonts/marsfont.png";
        const middle = MAZE_WIDTH / 2;
        const {x, y, width, height, optionY} = this.pauseMenuLayout();

        MDog.Draw.rectangleFill(x, y, width, height, COLORS.background);
        MDog.Draw.rectangle(x, y, width, height, COLORS.wall);
        MDog.Draw.rectangle(x + 2, y + 2, width - 4, height - 4, COLORS.wall);

        MDog.Draw.textImage("PAUSED", middle, y + 13, COLORS.snack, font, {size: 2, alignX: "center", alignY: "center"});
        this.pauseOptions().forEach((option, i) => {
            const selected = i === this.pauseSelection;
            const label = this.pauseOptionLabel(option);
            const text = selected ? "> " + label + " <" : label;
            MDog.Draw.textImage(text, middle, optionY(i), selected ? COLORS.snack : COLORS.text, font, {alignX: "center", alignY: "center"});
        });
        MDog.Draw.textImage(this.hints().menu, middle, y + height - 8, COLORS.dim, font, {alignX: "center", alignY: "center"});
    }
}

game.snackMan = new SnackMan(game.board, game.effects, {
    onEat: () => game.sound.chomp(),
    onBite: () => {
        game.sound.bite();
        game.vibrate(VIBRATIONS.bite);
    },
    onBonus: (points, x, y) => game.showBonus(points, x, y),
    onPiecePop: () => game.sound.pop(),
    onDie: () => {
        game.sound.bite(); // the crash itself, before the slow death
        game.endRound(true);
        game.vibrate(VIBRATIONS.death);
    },
    onDeathSound: seconds => game.sound.death(seconds),
    onDeathOver: () => game.endOfRun()
}, game.controls);

// Tabbing away (or the window losing focus) pauses the game, so it's safe
window.addEventListener("blur", () => {
    if (game.state === "playing") {
        game.pause();
    }
});
document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === "playing") {
        game.pause();
    }
});

function update() {
    game.update();
    game.draw();
}

// Load the images up front, so nothing is missing for a moment the first time it's drawn. The recolored
// shapes and MDog.Draw.image keep separate caches, so each needs loading. Drawing off-screen starts the load.
for (const dir of ["right", "up"]) {
    for (const frame of [1, 2, 3]) {
        const name = "snack-man/snack-man-" + dir + "-" + frame + ".png";
        loadShape(name);
        MDog.Draw.image(name, -1000, -1000);
    }
}
loadShape("snack-man/map.png");
MDog.Draw.image("snack-man/map.png", -1000, -1000);

// Without a viewport tag, phones lay the page out as if it were a 980 pixel wide desktop screen and
// shrink it to fit, which makes the game tiny. Adding it here leaves index.html alone.
if (document.querySelector("meta[name=viewport]") === null) {
    const viewport = document.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
    document.head.appendChild(viewport);
    window.dispatchEvent(new Event("resize")); // so MDog sizes the canvas for the new layout
}

MDog.Draw.setBackgroundColor("#000000");
MDog.setActiveFunction(update);
