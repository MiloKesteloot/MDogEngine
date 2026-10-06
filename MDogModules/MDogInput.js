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
        this.typedKeys = [];

        // The name each held key had when it was pressed, by physical key. Holding shift can change a key's name
        // (like "1" to "!"), so this is used on keyup to remove the name it was pressed with. -CAI
        this.keysByCode = {};

        window.addEventListener("keydown", e => {

            let key = e.key;
            if (key.length === 1) {
                key = key.toLowerCase();
            }

            if (e.code) {
                this.keysByCode[e.code] = key;
            }

            const downIndex = this.downKeys.indexOf(key);
            if (downIndex === -1) {
                this.downKeys.push(key);
            }
            const clickedIndex = this.clickedKeys.indexOf(key);
            if (downIndex === -1 && clickedIndex === -1) {
                this.clickedKeys.push(key);
            }
            const typedIndex = this.typedKeys.indexOf(e.key);
            if (downIndex === -1 && typedIndex === -1) {
                this.typedKeys.push(e.key);
            }
        });

        window.addEventListener("keyup", e => {
            let key = e.key;
            if (key.length === 1) {
                key = key.toLowerCase();
            }

            // Remove the name the key was pressed with, and the name it has now, in case they're different -CAI
            const pressedKey = this.keysByCode[e.code];
            delete this.keysByCode[e.code];
            this.downKeys = this.downKeys.filter(k => k !== key && k !== pressedKey);
        });

        // Keys let go of while the game isn't focused (like after clicking somewhere else) never send a keyup,
        // so everything counts as let go when focus leaves -CAI
        window.addEventListener("blur", () => {
            this.downKeys = [];
            this.keysByCode = {};
        });
    }

    update() {
        this.clickedKeys = []
        this.typedKeys = []
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

        const updatePosition = e => {
            const canvas =  Draw.mainDrawingBoard.element; // TODO this might be a little scuffed. I'm not sure I should access mainDrawingBoard like this.
            const rect = canvas.getBoundingClientRect();

            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const pixelX = Math.floor(x / rect.width * canvas.width);
            const pixelY = Math.floor(y / rect.height * canvas.height);

            this.x = pixelX;
            this.y = pixelY;
        };

        this.element.addEventListener("mousemove", updatePosition);
        this.element.addEventListener("mousedown", e => {
            // Taps on phones don't always move the mouse first, so the position is updated here too -CAI
            updatePosition(e);
            this.down[e.button] = true;
            this.clicked[e.button] = true;
        });
        // Listened for on the whole window, so letting go of a button outside of the game still counts -CAI
        window.addEventListener("mouseup", e => {
            this.down[e.button] = false;
        });
        // Buttons let go of while the game isn't focused never send a mouseup -CAI
        window.addEventListener("blur", () => {
            this.down = [false, false, false];
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

    // These request the style instead of setting it directly, since update() puts the requested style back every tick -CAI
    show() {
        this.requestStyle("auto");
        this.style();
    }

    hide() {
        this.requestStyle("none");
        this.style();
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
        this.style();
    }

    // TODO add ability to enable right click menu
    disableContextMenu() {
        this.element.addEventListener("contextmenu", e => {
            e.preventDefault();
        });
    }
}

export default Input;