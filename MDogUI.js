import Module from "/MDogModule.js";
import Maths from "/MDogMaths.js";

const Vector = (new Maths()).Vector;

class Page {
    constructor() {
        this.interactables = [];
    }

    addInteractable(interactable) {
        this.interactables.push(interactable);
    }

    _draw(Draw) {
        for (let i = 0; i < this.interactables.length; i++) {
            this.interactables[i].draw();
        }
    }
}

class Interactable {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    getX() {
        return this.x;
    }

    getY() {
        return this.y;
    }

    setX(x) {
        this.x = x;
    }

    setY(y) {
        this.y = y;
    }

    _draw(Draw) {}
}

class GridInteractable extends Interactable {
    constructor(x, y, width, height, xx, xy, yx, yy) {
        super(x, y);

        this.width = width;
        this.height = height;

        this.xv = new Vector(xx, xy);
        this.yv = new Vector(yx, yy);
    }

    _draw(Draw) {
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                const p00 = this.getPoint(i, j);
                const p10 = this.getPoint(i+1, j);
                const p01 = this.getPoint(i, j+1);

                Draw.line(p00.x, p00.y, p00.x, p00.y, "#ff0000");
            }
        }
    }

    // Grid space to world space
    getPoint(x, y) {
        const vec = new Vector(this.x, this.y);
        const xv = this.xv.clone().multiply(x);
        const yv = this.yv.clone().multiply(y);
        return vec.add(xv).add(yv);
    }
}

class TilemapInteractable extends Interactable {
    constructor(x, y, tilemap, tileSize, spriteSheet, spriteSheetWidth) {
        super(x, y);

        this.tileSize = tileSize;
        this.spriteSheet = spriteSheet;
        this.spriteSheetWidth = spriteSheetWidth;

        let rows = tilemap.replaceAll(" ", "").split("\n");

        this.height = rows.length;
        this.width = rows[0].split(",").length;

        this.grid = [];

        for (let i = 0; i < this.width; i++) {
            this.grid.push([]);

            for (let j = 0; j < this.height; j++) {
                this.grid[i].push(-1);
            }
        }

        for (let i = 0; i < rows.length; i++) {
            const newRow = rows[i];
            const cols = (newRow).split(",");
            for (let j = 0; j < cols.length; j++) {
                this.grid[j][i] = parseInt(cols[j]);
            }
        }
    }

    screenToTile(x, y) {
        let tx = Math.floor((x-this.x)/this.tileSize);
        let ty = Math.floor((y-this.y)/this.tileSize);
        return new Vector(tx, ty);
    }

    tileToScreen(x, y) {
        let sx = this.x + x*this.tileSize;
        let sy = this.y + y*this.tileSize;
        return new Vector(sx, sy);
    }

    _draw(Draw) {
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {

                const index = this.grid[i][j];

                if (index === -1) {
                    continue;
                }

                const x = index % this.spriteSheetWidth;
                const y = Math.floor(index / this.spriteSheetWidth);
                const offsetX = x*this.tileSize;
                const offsetY = y*this.tileSize;

                Draw.image(
                    this.spriteSheet,
                    this.x + i*this.tileSize,
                    this.y + j*this.tileSize,
                    {
                        width: this.tileSize,
                        height: this.tileSize,
                        offsetX: x*this.tileSize,
                        offsetY: y*this.tileSize,
                    })
            }
        }
    }



    get(x, y) {
        if (x < 0 || y < 0) {
            return -2;
        }
        if (x >= this.width || y >= this.height) {
            return -2;
        }
        return this.grid[x][y];
    }

    set(x, y, mat) {
        if (x < 0 || y < 0) {
            return;
        }
        if (x >= this.width || y >= this.height) {
            return;
        }
        this.grid[x][y] = mat;
    }
}

class UI extends Module {

    static Input = null;

    constructor(Input) {
        super();
        UI.Input = Input;

        this.GridInteractable = GridInteractable;
        this.TilemapInteractable = TilemapInteractable;
    }
}

export default UI;