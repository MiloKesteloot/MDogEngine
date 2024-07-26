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

class Point {
    constructor(x, y) {
        this.pos = new Vector(x, y);
    }

    draw() {
        MDog.Draw.rectangle(this.pos.x, this.pos.y, 8, 8, "#ffff00");
    }
}

class PacMan {
    constructor(x, y) {
        this.pos = new Vector(x*8, y*8);
        this.dir = new Vector(-1, 0);
        this.goalDir = new Vector(0, -1);
        this.progress = 0;
        this.speed = 0.4;
        this.length = 1;
        this.points = [];
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
            this.length += 8;
        }
        if (getMapPixels(x, y) === _W) {
            setMapPixels(x, y, _B);
            console.log("Mega!")
        }
    }

    update() {

        let options = [
            {keys: keys.left, dir: new Vector(-1, 0)},
            {keys: keys.right, dir: new Vector(1, 0)},
            {keys: keys.up, dir: new Vector(0, -1)},
            {keys: keys.down, dir: new Vector(0, 1)}
        ]

        for (let op of options) {
            if (keyDown(op.keys)) {
                if (this.length > 1 && op.dir.clone().multiply(-1).equals(this.dir)) {
                    continue;
                }
                this.goalDir.set(op.dir);
            }
        }

        this.progress += this.speed;
        if (this.progress >= 1) {
            let ahead;
            const goalAhead = this.getTouching(this.pos.x + this.goalDir.x, this.pos.y + this.goalDir.y);
            if (goalAhead !== HH) {
                ahead = goalAhead;
                if (!this.dir.equals(this.goalDir)) {
                    this.dir.set(this.goalDir);
                    this.points.unshift(new Point(this.pos.x, this.pos.y));
                }

            } else {
                ahead = this.getTouching(this.pos.x + this.dir.x, this.pos.y + this.dir.y);
            }
            if (ahead !== HH) {
                this.pos.add(this.dir);
                this.progress = 0;
            }
        }
        this.eat();

        let lastPoint = this;
        let dist = 0;
        let savedDist = 0;
        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            dist += point.pos.distanceTo(lastPoint.pos);
            if (dist > this.length) {
                let toSplice = this.points.length-i-1;
                if (toSplice !== 0) {
                    this.points.splice(-toSplice);
                }

                if (point.pos.x === lastPoint.pos.x) {
                    let neg = point.pos.y < lastPoint.pos.y ? -1 : 1;
                    point.pos.y = lastPoint.pos.y + (this.length - savedDist)*neg;
                } else {
                    let neg = point.pos.x < lastPoint.pos.x ? -1 : 1;
                    point.pos.x = lastPoint.pos.x + (this.length - savedDist)*neg;
                }
            }
            lastPoint = point;
            savedDist = dist;
        }
    }

    draw() {
        MDog.Draw.image("snack-man/snack-man-1.png", this.pos.x-2, this.pos.y-2);

        let lastPoint = this;
        for (let point of this.points) {

            MDog.Draw.image("snack-man/snack-man-1.png", point.pos.x-2, point.pos.y-2);

            const lowX = Math.min(point.pos.x, lastPoint.pos.x);
            const highX = Math.max(point.pos.x, lastPoint.pos.x);
            const width = highX - lowX;
            const lowY = Math.min(point.pos.y, lastPoint.pos.y);
            const highY = Math.max(point.pos.y, lastPoint.pos.y);
            const height = highY - lowY;

            if (lastPoint.pos.x === point.pos.x) {
                MDog.Draw.rectangleFill(lowX - 2, lowY + 6, 13, height, "#ffff00");
            } else {
                MDog.Draw.rectangleFill(lowX + 6, lowY - 2, width, 13, "#ffff00");
            }

            lastPoint = point;
        }

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