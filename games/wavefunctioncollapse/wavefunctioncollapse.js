import MDog from "/MDogEngine/MDogModules/MDogMain.js"

class TileOption {
    constructor(url, up, right, down, left) {
        this.url = "wfc/" + url + ".png";
        this.up = up;
        this.right = right;
        this.down = down;
        this.left = left;
    }

    getDir(num) {
        while (num < 4) num += 4;
        switch (num % 4) {
            case 0: return this.up;
            case 1: return this.right;
            case 2: return this.down;
            case 3: return this.left;
            default: throw new Error("getDir(num) received '" + num + "' not a number 0, 1, 2, or 3.");
        }
    }
}

const g = "grass";
const p = "path";

function newMaterialList() {
    return [g, p];
}

const tileOptions = [
    new TileOption("none", g, g, g, g),

    new TileOption("left-right", g, p, g, p),
    new TileOption("up-down", p, g, p, g),

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

let size = 10;
let map = [];

for (let i = 0; i < size; i++) {
    map.push([]);
    for (let j = 0; j < size; j++) {
        map[i].push(newOptionList());
    }
}

function randFromList(list) {
    const length = list.length;
    if (length === 0) return null;
    // if (list.includes(0) && Math.random() > 0.05) return 0;
    return list[Math.floor(Math.random()*length)];
}

function getTileOption(optionNum) {
    return tileOptions[optionNum];
}

// This function takes a direction and a list of TileOption indexes and
// returns a set of the materials that go in that direction.
// 0, 1, 2, 3 - up, right, down, left.
function getDirOfTile(dir, options) {
    const materials = [];
    for (let i = 0; i < options.length; i++) {
        const optionNum = options[i];
        const material = getTileOption(optionNum).getDir(dir);
        if (!materials.includes(material)) {
            materials.push(material);
        }
    }
    return materials;
}

function update(x, y) {

    if (x < 0 || y < 0 || x >= size || y >= size) return;

    const optionNums = map[x][y];
    if (optionNums.length === 1) return;

    let up;
    if (y-1 >= 0) {
        up = getDirOfTile(2, map[x][y-1]);
    } else {
        up = newMaterialList();
    }

    let right;
    if (x+1 < size) {
        right = getDirOfTile(3, map[x+1][y]);
    } else {
        right = newMaterialList();
    }

    let down;
    if (y+1 < size) {
        down = getDirOfTile(0, map[x][y+1]);
    } else {
        down = newMaterialList();
    }

    let left;
    if (x-1 >= 0) {
        left = getDirOfTile(1, map[x-1][y]);
    } else {
        left = newMaterialList();
    }

    let changedOptionNums = false;

    for (let i = 0; i < optionNums.length; i++) {
        const optionNum = optionNums[i];
        const tileOption = getTileOption(optionNum);
        if ((! up.includes(tileOption.up)) ||
            (! right.includes(tileOption.right)) ||
            (! down.includes(tileOption.down)) ||
            (! left.includes(tileOption.left))) {
            optionNums.splice(i, 1);
            i -= 1;
            changedOptionNums = true;
        }
    }

    if (changedOptionNums) {
        update(x-1, y);
        update(x+1, y);
        update(x, y-1);
        update(x, y+1);
    }
}

function collapse(x, y) {
    const optionNums = map[x][y];
    if (optionNums.length === 1) return;
    map[x][y] = [randFromList(optionNums)];
    update(x-1, y);
    update(x+1, y);
    update(x, y-1);
    update(x, y+1);
}

let done = false;

function main() {
    if (!done) {
        done = true;
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                collapse(i, j);
            }
        }
    }

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const optionNums = map[i][j];
            if (optionNums.length === 1) {
                const tileOption = getTileOption(optionNums[0]);
                MDog.Draw.image(tileOption.url, i*16, j*16);
                if ((i+j)%2 === 0) {
                    MDog.Draw.rectangleFill(i*16, j*16, 16, 16, "#f0000022");
                }
            }
        }
    }
}

MDog.setActiveFunction(main);