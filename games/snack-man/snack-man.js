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

const keys = {
    up: ["ArrowUp", "w"],
    down: ["ArrowDown", "s"],
    left: ["ArrowLeft", "a"],
    right: ["ArrowRight", "d"],
    restart: ["r"]
}

function keyDown(keySet, hold) {
    hold = hold ?? true;
    for (const key of keySet) {
        if (hold ? MDog.Input.Keyboard.isDown(key) : MDog.Input.Keyboard.isClicked(key)) {
            return true;
        }
    }
    return false;
}

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
const TURN_BUFFER_TICKS = 40; // how long a released turn input is remembered (0.25s)
const LATE_TURN_WINDOW = 0.25; // how far past a tile center (in tiles) you can still turn
const BLOCKED_GRACE_TICKS = 24; // time to turn away when your face is up against your body (0.15s)
const CHOMP_PIXELS = 2.5; // pixels travelled per mouth frame
const CHOMP_FRAMES = [1, 2, 3, 2];
const STOPPED_MOUTH_FRAME = 2; // half open when he's stopped, so you can tell which way he's facing
const DEATH_FREEZE_TICKS = 50; // how long he flashes before his tail slides back in
const UNRAVEL_MIN_TICKS = 40; // even a tiny tail takes this long to slide back in, so the ease is visible
const UNRAVEL_MAX_TICKS = 140; // even a huge tail is back in by this point
const UNRAVEL_SPEED = 1.5; // average pixels per tick for tails in between
const DEATH_HOLD_TICKS = 25; // pause once the tail is gone, before the classic death
const DEATH_SPIN_TICKS = 110; // mouth opens all the way while he spins
const DEATH_SPINS = 1.5; // full turns during the spin
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

// Recolored copies of the face sprites, made once and reused (MDog's own tint makes a new canvas every draw)
const tintCache = new Map();

function tintedSprite(fileName, color) {
    const key = fileName + color;
    if (tintCache.has(key)) {
        return tintCache.get(key);
    }
    const image = MDog.Draw._getImageByName(fileName);
    if (!image.complete || image.naturalWidth === 0) {
        return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    tintCache.set(key, canvas);
    return canvas;
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

function burst(x, y, count, colors) {
    for (let i = 0; i < count; i++) {
        game.particles.push(new Particle(x, y, colors[i % colors.length]));
    }
}

// ---------- Bitten-off piece ----------

// The part of his tail he bit off. It flashes, then pops one segment at a time,
// starting where he bit it, and your score goes down with every pop.
class SeveredPiece {
    constructor(tiles) {
        this.tiles = tiles;
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
            burst(x, popped.y, 6, [COLORS.loss, COLORS.loss, COLORS.flash]);
            // Only every other segment gets a "-10" so they don't pile up; it's just there to show it's bad
            if (this.popped % 2 === 0) {
                game.lossTexts.push(new LossText(x, popped.y));
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
            circle(this.points[0].x + offsetX, this.points[0].y, color);
        }
    }
}

// ---------- Board ----------

class Board {
    constructor() {
        this.reset();
    }

    reset() {
        this.tiles = LAYOUT.join("").split("");
        this.pelletsLeft = this.tiles.filter(t => t === PELLET || t === POWER).length;
        this.totalPellets = this.pelletsLeft;
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

// ---------- Snack Man ----------

class SnackMan {
    constructor(board) {
        this.board = board;
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
        this.blockedTimer = 0;
        this.chompDistance = 0;

        this.dead = false;
        this.deathTimer = 0;
        this.unraveledAt = 0;
        this.unravelTotal = 0;
        this.unravelDuration = 0;
        this.unravelPopped = 0;
        this.unravelPixels = 0;

        this.blue = false; // from a power pellet: the next time he runs into himself, he bites instead of dying
        this.blueTimer = 0; // ticks since he turned blue, for the flash
        this.biteTimer = 0;
        this.pieces = [];
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
        for (const name in DIRS) {
            if (keyDown(keys[name], false)) {
                this.wantDir = DIRS[name];
                this.wantName = name;
                this.wantTimer = TURN_BUFFER_TICKS;
            }
        }

        if (this.wantDir !== null) {
            if (keyDown(keys[this.wantName])) {
                this.wantTimer = TURN_BUFFER_TICKS;
            } else {
                this.wantTimer -= 1;
                if (this.wantTimer <= 0) {
                    this.wantDir = null;
                    this.wantName = null;
                }
            }
        }
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
        this.pieces.push(new SeveredPiece(cut));

        this.blue = false;
        this.biteTimer = BITE_CHOMP_TICKS;
        game.shake();

        const c = center(tile);
        burst(c.x, c.y, 10, [COLORS.flash, COLORS.blue]);
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

        // Facing a wall is safe, you just wait. Facing your own body (or being boxed in) gives
        // you a moment to turn away before it counts as a crash.
        const headOn = this.isBodyBlocking(step(this.body[0], this.dir));
        if (headOn || !this.hasSafeMove()) {
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

        if (this.board.eat(this.target) === POWER) {
            if (!this.blue) {
                this.blueTimer = 0;
            }
            this.blue = true;
            const c = center(this.target);
            burst(c.x, c.y, 10, [COLORS.blue, COLORS.pellet]);
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

    update() {
        if (this.biteTimer > 0) this.biteTimer -= 1;
        if (this.blue) this.blueTimer += 1;

        if (this.dead) {
            this.updateDying();
            return;
        }

        this.readInput();

        if (!this.started) {
            if (this.wantDir === null || !this.canEnter(step(this.body[0], this.wantDir))) {
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

        const speed = game.speed();
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
        game.endRound();
        this.dead = true;
        this.deathTimer = 0;
        this.target = null;
        this.progress = 0;

        // The tail slides back into him, fast at first and easing out at the end
        this.unravelTotal = (this.body.length - 1) * TILE;
        this.unravelDuration = Math.min(UNRAVEL_MAX_TICKS, Math.max(UNRAVEL_MIN_TICKS, this.unravelTotal / UNRAVEL_SPEED));
        this.unravelPopped = 0; // pixels of tail already removed as whole tiles
        this.unravelPixels = 0; // pixels the current tail end has slid in
        this.unraveledAt = DEATH_FREEZE_TICKS; // when the tail finished sliding in
    }

    updateDying() {
        this.deathTimer += 1;

        if (this.deathTimer < DEATH_FREEZE_TICKS) {
            return;
        }

        if (this.body.length > 1) {
            const t = Math.min(1, (this.deathTimer - DEATH_FREEZE_TICKS) / this.unravelDuration);
            const easeOut = 1 - Math.pow(1 - t, 3);
            this.unravelPixels = this.unravelTotal * easeOut - this.unravelPopped;
            while (this.unravelPixels >= TILE && this.body.length > 1) {
                this.unravelPixels -= TILE;
                this.unravelPopped += TILE;
                const tail = this.body.pop();
                this.occupied[tileIndex(tail)] = false;
            }
            if (this.body.length === 1) {
                this.unravelPixels = 0;
            }
            this.unraveledAt = this.deathTimer;
            return;
        }

        const finale = DEATH_HOLD_TICKS + DEATH_SPIN_TICKS + DEATH_POP_TICKS + DEATH_AFTER_TICKS;
        if (this.deathTimer - this.unraveledAt > finale) {
            game.restart();
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
            retract = Math.floor(this.unravelPixels);
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
        if (!this.started || this.dead) {
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
        if (this.dead && this.deathTimer < DEATH_FREEZE_TICKS && Math.floor(this.deathTimer / 6) % 2 === 0) {
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
        const flip = {flipX: this.dir.x < 0, flipY: this.dir.y > 0};

        if (color === COLORS.snack) {
            MDog.Draw.image(name, x - 6, y - 6, flip);
            return;
        }
        const tinted = tintedSprite(name, color);
        if (tinted !== null) {
            MDog.Draw._rawImage(tinted, x - 6, y - 6, tinted.width, tinted.height, flip);
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
        if (this.deathFinaleFrame() >= 0) {
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
        const finaleFrame = this.deathFinaleFrame();
        for (const offsetX of this.offsets) {
            if (finaleFrame >= 0) {
                this.drawDeathFinale(head.x + offsetX, head.y, finaleFrame);
            } else {
                this.drawFace(head.x + offsetX, head.y, this.color());
            }
        }
    }

    // Ticks since his tail finished sliding back in after dying, or -1 if that hasn't happened
    deathFinaleFrame() {
        if (!this.dead || this.body.length > 1 || this.deathTimer < DEATH_FREEZE_TICKS) {
            return -1;
        }
        return this.deathTimer - this.unraveledAt;
    }

    // The classic Pac-Man death: his mouth opens all the way while he spins, then he pops
    drawDeathFinale(x, y, frame) {
        const popStart = DEATH_HOLD_TICKS + DEATH_SPIN_TICKS;

        if (frame < popStart) {
            const t = Math.max(0, (frame - DEATH_HOLD_TICKS) / DEATH_SPIN_TICKS);
            const facing = Math.atan2(this.dir.y, this.dir.x) - Math.PI * 2 * DEATH_SPINS * t * t;
            const halfMouth = Math.PI * Math.pow(t, 1.5);
            pie(x, y, facing, halfMouth, COLORS.snack);
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

const game = {
    tick: 0,
    level: 1,
    board: new Board(),
    snackMan: null,
    clearTimer: 0,
    particles: [],
    lossTexts: [],
    shakeTimer: 0,
    best: loadBest(),
    finalScore: null, // set when the round is over, so the score stops changing
    newBest: false,

    // Back to level 1 with a fresh board (after dying, or pressing R)
    restart() {
        this.level = 1;
        this.startLevel();
    },

    startLevel() {
        this.clearTimer = 0;
        this.particles = [];
        this.lossTexts = [];
        this.shakeTimer = 0;
        this.finalScore = null;
        this.newBest = false;
        this.board.reset();
        this.snackMan.reset();
    },

    speed() {
        return SPEED * Math.min(MAX_SPEED_MULTIPLIER, 1 + SPEED_PER_LEVEL * (this.level - 1));
    },

    // Your score is just how long you are: every segment is a pellet you ate. Bitten-off
    // segments still count until they pop, so the score drains away as they do.
    getScore() {
        if (this.finalScore !== null) {
            return this.finalScore;
        }
        const bitten = this.snackMan.pieces.reduce((sum, piece) => sum + piece.tiles.length, 0);
        return (this.snackMan.body.length - 1 + bitten) * PELLET_POINTS;
    },

    // The round is over (he died, or cleared the board). Your score is how long you are right
    // now; anything you bit off is already lost, even if it hasn't finished popping.
    endRound() {
        this.finalScore = (this.snackMan.body.length - 1) * PELLET_POINTS;
        if (this.finalScore > this.best) {
            this.best = this.finalScore;
            this.newBest = true;
            saveBest(this.best);
        }
    },

    isClearing() {
        return this.board.pelletsLeft === 0;
    },

    getMaxScore() {
        return this.board.totalPellets * PELLET_POINTS;
    },

    shake() {
        this.shakeTimer = SHAKE_TICKS;
    },

    update() {
        this.tick += 1;

        if (keyDown(keys.restart, false)) {
            this.restart();
            return;
        }

        for (const particle of this.particles) {
            particle.update();
        }
        this.particles = this.particles.filter(particle => particle.life > 0);
        for (const text of this.lossTexts) {
            text.update();
        }
        this.lossTexts = this.lossTexts.filter(text => text.life > 0);
        if (this.shakeTimer > 0) this.shakeTimer -= 1;

        this.snackMan.updatePieces();

        if (this.isClearing()) {
            this.updateClear();
        } else {
            this.snackMan.update();
        }
    },

    // Board cleared: freeze, flash the maze like Pac-Man, then on to the next (faster) level
    updateClear() {
        // Let any bitten-off piece finish popping first, so the final score is settled
        if (this.finalScore === null) {
            if (this.snackMan.pieces.length > 0) {
                return;
            }
            this.endRound();
        }
        this.clearTimer += 1;
        if (this.clearTimer >= CLEAR_PAUSE_TICKS + CLEAR_FLASH_TICKS * CLEAR_FLASHES) {
            this.level += 1;
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
        let shakeX = 0;
        let shakeY = 0;
        if (this.shakeTimer > 0) {
            const amount = Math.ceil(SHAKE_AMOUNT * this.shakeTimer / SHAKE_TICKS);
            shakeX = Math.round((Math.random() * 2 - 1) * amount);
            shakeY = Math.round((Math.random() * 2 - 1) * amount);
        }
        MDog.Draw.translate(MAZE_X + shakeX, MAZE_Y + shakeY);

        MDog.Draw.clear({color: COLORS.background});
        const whiteMaze = this.mazeFlashing() ? tintedSprite("snack-man/map.png", COLORS.flash) : null;
        if (whiteMaze !== null) {
            MDog.Draw._rawImage(whiteMaze, 0, 0, whiteMaze.width, whiteMaze.height);
        } else {
            MDog.Draw.image("snack-man/map.png", 0, 0);
        }

        this.snackMan.drawUnderPellets(this.tick);
        this.board.drawPellets(this.tick);
        this.snackMan.drawOverPellets(this.tick);
        for (const particle of this.particles) {
            particle.draw();
        }
        for (const text of this.lossTexts) {
            text.draw();
        }

        // Hide anything poking out of the tunnel
        const screenHeight = MDog.Draw.getScreenHeightInArtPixels();
        MDog.Draw.rectangleFill(-MAZE_X - SHAKE_AMOUNT, -MAZE_Y - SHAKE_AMOUNT, MAZE_X + SHAKE_AMOUNT, screenHeight + SHAKE_AMOUNT * 2, COLORS.background);
        MDog.Draw.rectangleFill(MAZE_WIDTH, -MAZE_Y - SHAKE_AMOUNT, MAZE_X + SHAKE_AMOUNT, screenHeight + SHAKE_AMOUNT * 2, COLORS.background);

        MDog.Draw.translate(MAZE_X, MAZE_Y);
        this.drawHud();
    },

    drawHud() {
        const font = "fonts/marsfont.png";
        const top = -30;

        // Score (out of the most you could get on this board) on the left, best on the right
        const draining = this.snackMan.pieces.length > 0 && this.finalScore === null;
        MDog.Draw.textImage("SCORE", 0, top, COLORS.label, font);
        MDog.Draw.textImage(this.getScore() + "/" + this.getMaxScore(), 0, top + 9, draining ? COLORS.scoreDrain : COLORS.text, font, {size: 2});

        const bestFlashing = this.newBest && Math.floor(this.tick / 12) % 2 === 0;
        MDog.Draw.textImage("BEST", MAZE_WIDTH, top, COLORS.label, font, {alignX: "right"});
        MDog.Draw.textImage("" + this.best, MAZE_WIDTH, top + 9, bestFlashing ? COLORS.snack : COLORS.text, font, {size: 2, alignX: "right"});

        MDog.Draw.textImage("LEVEL " + this.level, 0, MAZE_HEIGHT + 8, COLORS.label, font);
        MDog.Draw.textImage("R TO RESTART", MAZE_WIDTH, MAZE_HEIGHT + 8, COLORS.dim, font, {alignX: "right"});

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
    }
}
game.snackMan = new SnackMan(game.board);

function update() {
    game.update();
    game.draw();
}

MDog.Draw.setBackgroundColor("#000000");
MDog.setActiveFunction(update);
