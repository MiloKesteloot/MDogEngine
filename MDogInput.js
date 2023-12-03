import Module from "./MDogModule.js";

class Input extends Module {
    constructor(Draw) {
        super();
        this.Keyboard = new Keyboard();
        this.Mouse = new Mouse(Draw);
    }

    _postUpdate() {
        this.Keyboard.update();
        this.Mouse.update();
    }
}

class Keyboard {
    constructor() {
        this.downKeys = [];
        this.clickedKeys = [];

        window.addEventListener("keydown", e => {

            let key = e.key;
            if (key.length === 1) {
                key = key.toLowerCase();
            }

            const downIndex = this.downKeys.indexOf(key);
            if (downIndex === -1) {
                this.downKeys.push(key);
            }
            const clickedIndex = this.clickedKeys.indexOf(key);
            if (downIndex === -1 && clickedIndex === -1) {
                this.clickedKeys.push(key);
            }
        });

        window.addEventListener("keyup", e => {
            let key = e.key;
            if (key.length === 1) {
                key = key.toLowerCase();
            }

            const index = this.downKeys.indexOf(key);
            if (index > -1) {
                this.downKeys.splice(index, 1);
            }
        });
    }

    update() {
        this.clickedKeys = []
    }

    isDown(key) {
        return this.downKeys.includes(key);
    }

    isClicked(key) {
        return this.clickedKeys.includes(key);
    }
}

class Mouse {
    constructor(Draw) {
        this.x = 0;
        this.y = 0;
        this.down = false;
        this.clicked = false;
        this.onScreen = false;
        this.newStyle = "default";
        this.element = Draw.mainCanvas.element;

        this.element.addEventListener("mousemove", e => {
            this.x = e.offsetX; //Math.floor(e.offsetX/this.scale);
            this.y = e.offsetY; //Math.floor(e.offsetY/this.scale);
        });
        this.element.addEventListener("mousedown", e => {
            this.down = true;
            this.clicked = true;
        });
        this.element.addEventListener("mouseup", e => {
            this.down = false;
        });
        this.element.addEventListener("mouseout", e => {
            this.onScreen = false;
        });
        this.element.addEventListener("mouseover", e => {
            this.onScreen = true;
        });
    }

    getDown() {
        return this.down;
    }

    getClick() {
        return this.clicked;
    }

    getOnScreen() {
        return this.onScreen;
    }

    getX() {
        return this.x;
    }

    getY() {
        return this.y;
    }

    show() {
        this.style("auto");
    }

    hide() {
        this.style("none");
    }

    requestStyle(style) {
        this.newStyle = style;
    }

    getNewStyle() {
        return this.newStyle;
    }

    style() {
        this.element.style.cursor = this.getNewStyle();
    }

    update() {
        this.clicked = false;
        this.style(this.newStyle);
    }
}

export default Input;