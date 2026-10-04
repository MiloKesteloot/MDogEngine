/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                                                                      ║
 * ║    ███████ ███    ██  █████   ██████ ██   ██     ███    ███  █████   ║
 * ║    ██      ████   ██ ██   ██ ██      ██  ██      ████  ████ ██   ██  ║
 * ║    ███████ ██ ██  ██ ███████ ██      █████       ██ ████ ██ ███████  ║
 * ║         ██ ██  ██ ██ ██   ██ ██      ██  ██      ██  ██  ██ ██   ██  ║
 * ║    ███████ ██   ████ ██   ██  ██████ ██   ██     ██      ██ ██   ██  ║
 * ║                                                                      ║
 * ║                          ~ REMASTERED ~                              ║
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
const SPEED = 7.5 / TICKS_PER_SECOND; // tiles per tick
const TURN_BUFFER_TICKS = 40; // how long a released turn input is remembered (0.25s)
const LATE_TURN_WINDOW = 0.25; // how far past a tile center (in tiles) you can still turn
const BLOCKED_GRACE_TICKS = 24; // time to turn away when your face is up against your body (0.15s)
const CHOMP_PIXELS = 2.5; // pixels travelled per mouth frame
const CHOMP_FRAMES = [1, 2, 3, 2];
const PELLET_POINTS = 10;

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

const COLORS = {
    background: "#000000",
    pellet: "#ffb9af",
    snack: "#ffff00",
    flash: "#ffffff"
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
        return !this.board.isWall(tile) && !this.isBodyBlocking(tile);
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
        this.grows = this.board.hasPellet(this.target);
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

        this.board.eat(this.target);

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

    update() {
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

        this.progress += SPEED;
        this.chompDistance += SPEED * TILE;

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
        this.dead = true;
        this.deathTimer = 0;
        this.target = null;
        this.progress = 0;
    }

    updateDying() {
        this.deathTimer += 1;

        const freezeTicks = 50;
        if (this.deathTimer < freezeTicks) {
            return;
        }

        // Unravel from the tail, quickly enough that long snakes don't take forever
        const interval = Math.max(1, Math.floor(100 / this.body.length));
        if (this.body.length > 1) {
            if (this.deathTimer % interval === 0) {
                const tail = this.body.pop();
                this.occupied[tileIndex(tail)] = false;
            }
            this.unraveledAt = this.deathTimer;
            return;
        }

        if (this.deathTimer - this.unraveledAt > 40) {
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

        let last = head;
        for (const tile of this.body) {
            const c = center(tile);
            // Unwrap the tunnel so the path stays continuous
            while (c.x - last.x > MAZE_WIDTH / 2) c.x -= MAZE_WIDTH;
            while (last.x - c.x > MAZE_WIDTH / 2) c.x += MAZE_WIDTH;
            points.push(c);
            last = c;
        }

        // The tail end slides along with the head when it's about to give up a tile
        if (moving && !this.grows) {
            const end = points[points.length - 1];
            const before = points[points.length - 2];
            end.x += Math.sign(before.x - end.x) * px;
            end.y += Math.sign(before.y - end.y) * px;
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

    // Draws a stretch of trail. roundEnd rounds off its last point (used for the tail tip).
    drawTrail(points, offsetX, color, roundEnd) {
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
            if (isEnd ? roundEnd : !this.isStraight(points[i - 1], points[i], points[i + 1])) {
                circle(points[i].x + offsetX, points[i].y, color);
            }
        }
    }

    isStraight(a, b, c) {
        return Math.sign(b.x - a.x) === Math.sign(c.x - b.x) && Math.sign(b.y - a.y) === Math.sign(c.y - b.y);
    }

    mouthFrame() {
        if (!this.started || this.dead) {
            return 1;
        }
        return CHOMP_FRAMES[Math.floor(this.chompDistance / CHOMP_PIXELS) % CHOMP_FRAMES.length];
    }

    drawFace(x, y) {
        const horizontal = this.dir.x !== 0;
        const name = "snack-man/snack-man-" + (horizontal ? "right" : "up") + "-" + this.mouthFrame() + ".png";
        MDog.Draw.image(name, x - 6, y - 6, {flipX: this.dir.x < 0, flipY: this.dir.y > 0});
    }

    // Snack Man is drawn in layers around the pellets: body and a black mouth first, then the
    // pellets, then the face, so pellets show up inside his open mouth as he eats them.
    drawUnderPellets(tick) {
        const points = this.getPath();
        this.points = points;

        // When he's in the tunnel, draw a copy on the other side too
        this.offsets = [0];
        if (points.some(p => p.x < 8)) this.offsets.push(MAZE_WIDTH);
        if (points.some(p => p.x > MAZE_WIDTH - 8)) this.offsets.push(-MAZE_WIDTH);

        const flashing = this.dead && this.deathTimer < 50 && Math.floor(this.deathTimer / 6) % 2 === 0;
        const color = flashing ? COLORS.flash : COLORS.snack;

        // A black disc behind the face fills his open mouth. His neck goes under it, so it never
        // shows inside his mouth. The rest of his body goes over it, so if his own tail is right
        // in front of him, you see the tail in his mouth instead of a black outline.
        const {neck, rest} = this.splitNeck(points);
        for (const offsetX of this.offsets) {
            this.drawTrail(neck, offsetX, color, rest.length < 2);
        }
        for (const offsetX of this.offsets) {
            circle(points[0].x + offsetX, points[0].y, COLORS.background);
        }
        for (const offsetX of this.offsets) {
            this.drawTrail(rest, offsetX, color, true);
        }
    }

    drawOverPellets(tick) {
        const head = this.points[0];
        for (const offsetX of this.offsets) {
            this.drawFace(head.x + offsetX, head.y);
        }
    }
}

// ---------- Game ----------

const game = {
    tick: 0,
    board: new Board(),
    snackMan: null,
    clearTimer: 0,

    restart() {
        this.clearTimer = 0;
        this.board.reset();
        this.snackMan.reset();
    },

    // Your score is just how long you are: every segment is a pellet you ate
    getScore() {
        return (this.snackMan.body.length - 1) * PELLET_POINTS;
    },

    update() {
        this.tick += 1;

        if (keyDown(keys.restart, false)) {
            this.restart();
            return;
        }

        if (this.board.pelletsLeft === 0) {
            // TODO (chunk 3): level clear celebration and next level
            this.clearTimer += 1;
            if (this.clearTimer > TICKS_PER_SECOND) {
                this.restart();
            }
        } else {
            this.snackMan.update();
        }
    },

    draw() {
        MDog.Draw.clear({color: COLORS.background});
        MDog.Draw.image("snack-man/map.png", 0, 0);

        this.snackMan.drawUnderPellets(this.tick);
        this.board.drawPellets(this.tick);
        this.snackMan.drawOverPellets(this.tick);

        // Hide anything poking out of the tunnel
        const screenHeight = MDog.Draw.getScreenHeightInArtPixels();
        MDog.Draw.rectangleFill(-MAZE_X, -MAZE_Y, MAZE_X, screenHeight, COLORS.background);
        MDog.Draw.rectangleFill(MAZE_WIDTH, -MAZE_Y, MAZE_X, screenHeight, COLORS.background);
    }
}
game.snackMan = new SnackMan(game.board);

function update() {
    game.update();
    game.draw();
}

MDog.Draw.translate(MAZE_X, MAZE_Y);
MDog.Draw.setBackgroundColor("#000000");
MDog.setActiveFunction(update);
