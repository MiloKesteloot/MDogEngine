import MDog from "/MDogEngine/MDogModules/MDogMain.js"

class RectangleInteractable extends MDog.UI.Interactable {
    constructor(x, y, width, height) {
        super(x, y);
        this.width = width;
        this.height = height;
    }

    _draw(Draw) {
        MDog.Draw.rectangle(this.x, this.y, this.width, this.height, "#FF0000");
    }

    getMouseOver() {
        let mouse = MDog.Input.Mouse;
        return mouse.x >= this.x && mouse.x < this.x + this.width && mouse.y >= this.y && mouse.y < this.y + this.height;
    }
}
class TextBoxInteractable extends RectangleInteractable {
    constructor(x, y, width, label, prompt) {
        super(x, y, width, 20);
        this.label = label;
        this.prompt = prompt;
        this.text = "";
        this.focused = false;
        this.timer = 0;
        this.blinkSpeed = 90;
    }

    _update() {
        if (
            !this.getMouseOver() && MDog.Input.Mouse.getClick(0)) {
            this.focused = false;
        }
        if (this.getMouseOver() && MDog.Input.Mouse.getClick(0)) {
            this.focused = true;
            this.timer = 0;
        }
        if (this.focused) {
            if (MDog.Input.Keyboard.isClicked("Backspace")) {
                this.text = this.text.slice(0, -1);
            } else if (MDog.Input.Keyboard.isClicked("Enter") || MDog.Input.Keyboard.isClicked("Escape")) {
                this.focused = false;
            } else {
                let key = MDog.Input.Keyboard.typedKeys[0];
                if (key && key.length === 1) {
                    this.text += key;
                }
            }
        }
    }

    _draw(Draw) {
        let color = "#969696"
        if (this.getMouseOver()) color = "#6c6c6c";
        if (this.focused) color = "#545454";
        MDog.Draw.rectangleFill(this.x+1, this.y+1, this.width-2, this.height-2, color);
        MDog.Draw.line(this.x+1, this.y, this.x + this.width - 2, this.y, "#FFFFFF");
        MDog.Draw.line(this.x+1, this.y+this.height - 1, this.x + this.width - 2, this.y+this.height - 1, "#FFFFFF");
        MDog.Draw.line(this.x, this.y+1, this.x, this.y+this.height-2, "#FFFFFF");
        MDog.Draw.line(this.x+this.width-1, this.y+1, this.x+this.width-1, this.y+this.height-2, "#FFFFFF");
        let text = this.text;
        let textColor = "#FFFFFF";
        if (this.focused) {
            this.timer++;
            if (Math.floor(this.timer / this.blinkSpeed)%2 === 0) {
                text += "_";
            }
        } else {
            if (this.text === "") {
                text = this.prompt;
                textColor = "#bdbdbd";
            }
        }
        MDog.Draw.textImage(this.label, this.x + 1, this.y - 5, "#ececec", "fonts/marsfont.png", {size: 1, alignX: "left", alignY: "bottom"});
        MDog.Draw.textImage(text, this.x + 5, this.y + this.height / 2, textColor, "fonts/determinationfont.png", {size: 1, alignX: "left", alignY: "center"});
    }
}
class NumberBoxInteractable extends TextBoxInteractable {
    constructor(x, y, width, label, min, max, defaultValue) {
        super(x, y, width, label, "");
        this.min = min;
        this.max = max;
        this.text = defaultValue.toString();
    }

    _update() {
        super._update();
        this.text = this.text.replace(/[^0-9]/g, '');
        if (!this.focused && this.text === "") {
            this.text = this.min.toString();
        }
    }
}
class TilePickerInteractable extends MDog.UI.TilemapInteractable {
    constructor(x, y, tilemap, tileSize, spriteSheet, spriteSheetWidth, settings) {
        super(x, y, tilemap, tileSize, spriteSheet, spriteSheetWidth, settings);
        this.selectedTilePos = new (MDog.Math.Vector)(0, 0);
        this.selectedTile = this.get(this.selectedTilePos.x, this.selectedTilePos.y);
    }

    _update() {
        if (this.getMouseOver() && MDog.Input.Mouse.getDown(0)) {
            this.selectedTilePos = this.getHoveredOverTile();
            this.selectedTile = this.get(this.selectedTilePos.x, this.selectedTilePos.y);
        }
    }

    _draw(Draw) {
        drawNiceBackground(this.x, this.y, this.getWidth(), this.getHeight(), this.scale);
        MDog.Draw.rectangleFill(
            this.x + this.selectedTilePos.x*this.tileSize*this.scale,
            this.y + this.selectedTilePos.y*this.tileSize*this.scale,
            this.tileSize*this.scale, this.tileSize*this.scale, "rgba(255,224,0,0.41)");
        super._draw(Draw);
    }
}
class TileMapInteractable extends MDog.UI.TilemapInteractable {
    constructor(x, y, tilemap, tileSize, spriteSheet, spriteSheetWidth, settings) {
        super(x, y, tilemap, tileSize, spriteSheet, spriteSheetWidth, settings);
    }

    _update() {
        if (this.getMouseOver()) {
            const pos = this.getHoveredOverTile();
            if (MDog.Input.Mouse.getDown(0)) {
                this.set(pos.x, pos.y, tilePicker.selectedTile);
            } else if (MDog.Input.Mouse.getDown(2)) {
                this.set(pos.x, pos.y, 0);
            }
        }
    }

    _draw(Draw) {

        drawNiceBackground(this.x, this.y, this.getWidth(), this.getHeight(), this.scale);

        super._draw(Draw);

        if (this.getMouseOver()) {
            const pos = this.getHoveredOverTile();
            for (let i = 0; i < this.scale; i++) {
                MDog.Draw.rectangle(
                    this.x + pos.x * this.tileSize * this.scale + i,
                    this.y + pos.y * this.tileSize * this.scale + i,
                    this.tileSize * this.scale - i*2,
                    this.tileSize * this.scale - i*2,
                    "#484848");
            }
        }
    }
}

function drawNiceBackground(x, y, width, height, scale) {
    for (let i = 0; i < scale; i++) {
        MDog.Draw.rectangle(
            x-1-i, y-1-i,
            width+2+2*i,
            height+2+2*i, "#000000"
        );
        MDog.Draw.rectangle(
            x-3-i, y-3-i,
            width+6+2*i,
            height+6+2*i, "#5F574F"
        );

    }
    MDog.Draw.rectangleFill(
        x, y,
        width, height, "#C2C3C7"
    );
}

MDog.Draw.setBackgroundColor("#302c38");

let page = null;
MDog.AssetManager.loadFile("hard-to-convey-level-editor/blank-tilemap-10x10.csv", "blankTilemap");
MDog.AssetManager.loadFile("hard-to-convey-level-editor/tile-picker.csv", "tilePicker");

let setup = false;

let tilePicker, tileMap, nameTextBox, widthTextBox, heightTextBox = null;

MDog.Input.Mouse.disableContextMenu();

function main() {

    if (!MDog.AssetManager.doneLoading()) {
        return;
    }
    if (!setup) {
        setup = true;
        page = new MDog.UI.Page(MDog.Draw);
        // page.addInteractable(new ButtonInteractable(400, 10, 100, 20, "Hello World"));

        tilePicker = new TilePickerInteractable(400, 150, MDog.AssetManager.get("tilePicker"), 16, "hard-to-convey-level-editor/spritesheet.png", 8, {scale: 2});
        page.addInteractable(tilePicker);
        tileMap = new TileMapInteractable(10, 10, MDog.AssetManager.get("blankTilemap"), 16, "hard-to-convey-level-editor/spritesheet.png", 8, {scale: 2});
        page.addInteractable(tileMap)
        nameTextBox = new TextBoxInteractable(350, 16, 120, "Level Name", "Level Name");
        page.addInteractable(nameTextBox);
        widthTextBox = new NumberBoxInteractable(350, 50, 55, "Width", 1, 10, 9);
        page.addInteractable(widthTextBox);
        heightTextBox = new NumberBoxInteractable(415, 50, 55, "Height", 1, 10, 9);
        page.addInteractable(heightTextBox);
    }

    page.update();
    MDog.Draw.clear({color: "#83769C"});
    page.draw();
}

MDog.setActiveFunction(main);
