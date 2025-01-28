import Module from "./MDogModule.js";
import Maths from "./MDogMaths.js";

const Vector = (new Maths()).Vector;

class Page {
    constructor(Draw) {
        this.Draw = Draw;
        this.interactables = [];
    }

    addInteractable(interactable) {
        this.interactables.push(interactable);
    }

    update() {
        for (let i = 0; i < this.interactables.length; i++) {
            this.interactables[i]._update();
        }
    }

    draw() {
        for (let i = 0; i < this.interactables.length; i++) {
            this.interactables[i]._draw(this.Draw);
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

    getMouseOver() {
        return false;
    }

    _update() {}

    _draw(Draw) {}
}

class RectangleGridInteractable extends Interactable {
    constructor(x, y, width, height) {
        super(x, y);

        this.width = width;
        this.height = height;
    }

    screenToTile(x, y) {
        let tx = Math.floor((x-this.x)/this.width);
        let ty = Math.floor((y-this.y)/this.height);
        return new Vector(tx, ty);
    }

    tileToScreen(x, y) {
        let sx = this.x + x*this.width;
        let sy = this.y + y*this.height;
        return new Vector(sx, sy);
    }

    _draw(Draw) {
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                const p00 = this.getPoint(i, j);

                Draw.point(p00.x, p00.y, "#ff0000");
            }
        }
    }
}

class VectorGridInteractable extends RectangleGridInteractable {
    constructor(x, y, width, height, xx, xy, yx, yy) {
        super(x, y, width, height);

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

    // TODO do screen to point function
}

class TilemapInteractable extends Interactable {
    // Settings - scale
    constructor(x, y, tilemap, tileSize, spriteSheet, spriteSheetWidth, settings) {
        super(x, y);

        settings = settings ?? {};
        this.scale = settings.scale ?? 1;

        this.tileSize = tileSize;
        this.spriteSheet = spriteSheet;
        this.spriteSheetWidth = spriteSheetWidth;

        let rows = tilemap.replaceAll(" ", "").split("\n");

        this.height = rows.length;
        if (rows[rows.length - 1] === "") {
            this.height--;
        }
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

    getMouseOver() {
        let mouse = UI.Input.Mouse;
        return mouse.x >= this.x &&
            mouse.x < this.x + this.width*this.tileSize*this.scale &&
            mouse.y >= this.y &&
            mouse.y < this.y + this.height*this.tileSize*this.scale;
    }

    screenToTile(x, y) {
        let tx = Math.floor((x-this.x)/this.tileSize/this.scale);
        let ty = Math.floor((y-this.y)/this.tileSize/this.scale);
        return new Vector(tx, ty);
    }

    tileToScreen(x, y) {
        let sx = this.x + x*this.tileSize*this.scale;
        let sy = this.y + y*this.tileSize*this.scale;
        return new Vector(sx, sy);
    }

    getHoveredOverTile() {
        let mouse = UI.Input.Mouse;
        return this.screenToTile(mouse.x, mouse.y);
    }

    getWidth() {
        return this.width * this.tileSize * this.scale;
    }

    getHeight() {
        return this.height * this.tileSize * this.scale;
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

                Draw.image(
                    this.spriteSheet,
                    this.x + i*this.tileSize*this.scale,
                    this.y + j*this.tileSize*this.scale,
                    {
                        width: this.tileSize,
                        height: this.tileSize,
                        offsetX: x*this.tileSize,
                        offsetY: y*this.tileSize,
                        scale: this.scale,
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

        this.Page = Page;
        this.Interactable = Interactable;
        this.RectangleGridInteractable = RectangleGridInteractable;
        this.VectorGridInteractable = VectorGridInteractable;
        this.TilemapInteractable = TilemapInteractable;
    }
}

export default UI;