import MDog from "/MDogEngine/MDogModules/MDogMain.js"

let time = 0;

class TileOption {
    constructor(url, up, right, down, left) {
        this.url = "wfc/" + url + ".png";
        this.up = up;
        this.right = right;
        this.down = down;
        this.left = left;
    }
}

const g = "grass";
const p = "path";

const tileOptions = [
    new TileOption("none", g, g, g, g),
    new TileOption("left-right", g, p, g, p),
    new TileOption("up-down", p, g, p, g),
    new TileOption("down-left", g, g, p, p),
    new TileOption("left-up", p, g, g, p),
    new TileOption("right-down", g, p, p, g),
    new TileOption("up-right", p, p, g, g),
    new TileOption("down-left-up", p, g, p, p),
    new TileOption("left-up-right", p, p, g, p),
    new TileOption("right-down-left", g, p, p, p),
    new TileOption("up-right-down", p, p, p, g),
    new TileOption("top-right-down-left", p, p, p, p)
]

function newOptionList() {
    const ret = [];
    for (let i = 0; i < tileOptions.length; i++) {
        ret.push(i);
    }
    return ret;
}

class Tile {
    constructor() {
        this.tile = null;
        this.options = newOptionList();
        this.lastUpdate = -1;
    }
}

let size = 4;
let map = [];

for (let i = 0; i < size; i++) {
    map.push([]);
    for (let j = 0; j < size; j++) {
        map[i].push(new Tile());
    }
}

function randFromList(list) {
    const length = list.length;
    if (length === 0) return null;
    return list[Math.floor(Math.random()*length)];
}

function collapse(x, y) {
    const tile = map[x][y];
    tile.tile = randFromList(tile.options);
}

function main() {
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            collapse(i, j);
            time += 1;
        }
    }
}

MDog.setActiveFunction(main);