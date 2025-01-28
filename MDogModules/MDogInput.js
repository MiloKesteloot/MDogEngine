import Module from "./MDogModule.js";

class Input extends Module {
    constructor(Draw) {
        super();
        this.Keyboard = new Keyboard();
        this.Mouse = new Mouse(Draw);
    }

    _postInUpdate() {
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
        this.down = [false, false, false];
        this.clicked = [false, false, false];
        this.onScreen = false;
        this.newStyle = "default";
        this.element = Draw.mainDrawingBoard.element;

        this.element.addEventListener("mousemove", e => {

            const canvas =  Draw.mainDrawingBoard.element; // TODO this might be a little scuffed. I'm not sure I should access mainDrawingBoard like this.
            const rect = canvas.getBoundingClientRect();

            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const pixelX = Math.floor(x / rect.width * canvas.width);
            const pixelY = Math.floor(y / rect.height * canvas.height);

            this.x = pixelX;
            this.y = pixelY;
        });
        this.element.addEventListener("mousedown", e => {
            console.log(e);
            this.down[e.button] = true;
            this.clicked[e.button] = true;
        });
        this.element.addEventListener("mouseup", e => {
            this.down[e.button] = false;
        });
        this.element.addEventListener("mouseout", e => {
            this.onScreen = false;
        });
        this.element.addEventListener("mouseover", e => {
            this.onScreen = true;
        });
    }

    // 0 is left, 1 is middle, 2 is right
    getDown(button) {
        return this.down[button ?? 0];
    }

    // 0 is left, 1 is middle, 2 is right
    getClick(button) {
        return this.clicked[button ?? 0];
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
        for (let i = 0; i < this.clicked.length; i++) {
            this.clicked[i] = false;
        }
        this.style(this.newStyle);
    }

    // TODO add ability to enable right click menu
    disableContextMenu() {
        this.element.addEventListener("contextmenu", e => {
            e.preventDefault();
        });
    }
}

export default Input;