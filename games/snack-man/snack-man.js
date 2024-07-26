import MDog from "/MDogEngine/MDogModules/MDogMain.js"
const Vector = MDog.Math.Vector;

const keys = {
    yes: ["Enter", "z", " "],
    no: ["Escape", "x"],
    up: ["ArrowUp", "w"],
    down: ["ArrowDown", "s"],
    left: ["ArrowLeft", "a"],
    right: ["ArrowRight", "d"]
}

function keyDown(keySet, hold) {
    hold = hold ?? true;

    for (let i = 0; i < keySet.length; i++) {
        if (hold) {
            if (MDog.Input.Keyboard.isDown(keySet[i])) {
                return true;
            }
        } else {
            if (MDog.Input.Keyboard.isClicked(keySet[i])) {
                return true;
            }
        }
    }
    return false;
}

const __ = 0;
const HH = 1;
const _B = 2;
const _W = 3;
const PM = 4;

const mapWidth = 28;
const mapHeight = 31;

const map = [
    HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH,
    HH, __, __, __, __, __, __, __, __, __, __, __, __, HH, HH, __, __, __, __, __, __, __, __, __, __, __, __, HH,
    HH, __, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, __, HH,
    HH, _W, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, _W, HH,
    HH, __, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, __, HH,
    HH, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, HH,
    HH, __, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, __, HH,
    HH, __, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, __, HH,
    HH, __, __, __, __, __, __, HH, HH, __, __, __, __, HH, HH, __, __, __, __, HH, HH, __, __, __, __, __, __, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, _B, HH, HH, _B, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, _B, HH, HH, _B, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, _B, _B, _B, _B, _B, _B, _B, _B, _B, _B, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, _B, HH, HH, HH, HH, HH, HH, HH, HH, _B, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, _B, HH, HH, HH, HH, HH, HH, HH, HH, _B, HH, HH, __, HH, HH, HH, HH, HH, HH,
    _B, _B, _B, _B, _B, _B, __, _B, _B, _B, HH, HH, HH, HH, HH, HH, HH, HH, _B, _B, _B, __, _B, _B, _B, _B, _B, _B,
    HH, HH, HH, HH, HH, HH, __, HH, HH, _B, HH, HH, HH, HH, HH, HH, HH, HH, _B, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, _B, HH, HH, HH, HH, HH, HH, HH, HH, _B, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, _B, _B, _B, _B, _B, _B, _B, _B, _B, _B, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, _B, HH, HH, HH, HH, HH, HH, HH, HH, _B, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, HH, HH, HH, HH, HH, __, HH, HH, _B, HH, HH, HH, HH, HH, HH, HH, HH, _B, HH, HH, __, HH, HH, HH, HH, HH, HH,
    HH, __, __, __, __, __, __, __, __, __, __, __, __, HH, HH, __, __, __, __, __, __, __, __, __, __, __, __, HH,
    HH, __, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, __, HH,
    HH, __, HH, HH, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, __, HH, HH, HH, HH, __, HH,
    HH, _W, __, __, HH, HH, __, __, __, __, __, __, __, _B, _B, __, __, __, __, __, __, __, HH, HH, __, __, _W, HH,
    HH, HH, HH, __, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, __, HH, HH, HH, // packman here
    HH, HH, HH, __, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, __, HH, HH, HH,
    HH, __, __, __, __, __, __, HH, HH, __, __, __, __, HH, HH, __, __, __, __, HH, HH, __, __, __, __, __, __, HH,
    HH, __, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, __, HH,
    HH, __, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, __, HH, HH, __, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, __, HH,
    HH, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, __, HH,
    HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH, HH,
]

function getMap(x, y) {
    return map[x + y*mapWidth];
}

function setMap(x, y, v) {
    map[x + y*mapWidth] = v;
}

function getMapPixels(x, y) {
    return map[Math.floor(x/8) + Math.floor(y/8)*mapWidth];
}

function setMapPixels(x, y, v) {
    map[Math.floor(x/8) + Math.floor(y/8)*mapWidth] = v;
}

class PacMan {
    constructor(x, y) {
        this.pos = new Vector(x*8, y*8);
        this.dir = new Vector(-1, 0);
        this.goalDir = new Vector(0, -1);
        this.progress = 0;
        this.speed = 0.4;
    }

    getTouching(x, y) {
        const touching = [];
        touching.push(getMapPixels(x, y));
        touching.push(getMapPixels(x + 7, y));
        touching.push(getMapPixels(x, y + 7));
        touching.push(getMapPixels(x + 7, y + 7));
        if (touching.includes(HH)) {
            return HH;
        }
        return __;
    }

    eat() {
        const x = this.pos.x;
        const y = this.pos.y;
        this.eatPoint(x, y);
        this.eatPoint(x + 7, y);
        this.eatPoint(x, y + 7);
        this.eatPoint(x + 7, y + 7);
    }

    eatPoint(x, y) {
        if (getMapPixels(x, y) === __) {
            setMapPixels(x, y, _B);
        }
        if (getMapPixels(x, y) === _W) {
            setMapPixels(x, y, _B);
            console.log("Mega!")
        }
    }

    update() {

        let newGoal = new Vector(0, 0);

        let options = [
            {keys: keys.left, dir: new Vector(-1, 0)},
            {keys: keys.right, dir: new Vector(1, 0)},
            {keys: keys.up, dir: new Vector(0, -1)},
            {keys: keys.down, dir: new Vector(0, 1)}
        ]

        for (let op of options) {
            if (keyDown(op.keys)) {
                this.goalDir.set(op.dir);
            }
        }

        this.progress += this.speed;
        if (this.progress >= 1) {
            let ahead;
            const goalAhead = this.getTouching(this.pos.x + this.goalDir.x, this.pos.y + this.goalDir.y);
            if (goalAhead !== HH) {
                ahead = goalAhead;
                this.dir.set(this.goalDir);
            } else {
                ahead = this.getTouching(this.pos.x + this.dir.x, this.pos.y + this.dir.y);
            }


            if (ahead === HH) {
            } else {
                this.pos.add(this.dir);
                this.progress = 0;
            }

        }

        this.eat();
    }

    draw() {
        MDog.Draw.image("snack-man/snack-man-1.png", this.pos.x-2, this.pos.y-2);
        MDog.Draw.rectangle(this.pos.x, this.pos.y, 8, 8, "#ffff00");
    }
}

const pacMan = new PacMan(13, 23);

function update() {
    MDog.Draw.clear({color: "black"});
    const size = 8;
    for (let i = 0; i < mapWidth; i++) {
        for (let j = 0; j < mapHeight; j++) {
            const icon = getMap(i, j);
            switch (icon) {
                case __:
                    MDog.Draw.rectangle(i*size+4, j*size+4, 2, 2, "#ffffff"); // TODO make this right color
            }
        }
    }
    MDog.Draw.image("snack-man/map.png", 0, 0);

    pacMan.update();
    pacMan.draw();
}

MDog.Draw.translateX(16*6+8);
MDog.Draw.translateY(16+8);
MDog.Draw.setBackgroundColor("#222222");
MDog.setActiveFunction(update);




// let str = "";
//
// for (let j = 0; j < 21; j++) {
//     for (let i = 0; i < 19; i++) {
//         switch (map[i+j*19]) {
//             case __:
//                 str += "•"
//                 break;
//             case HH:
//                 str += "■";
//                 break;
//             case BK:
//                 str += " ";
//                 break;
//             case _W:
//                 str += "o";
//                 break;
//             case PM:
//                 str += ">";
//                 break;
//         }
//     }
//     if (j !== 20) {
//         str += "\n";
//     }
// }