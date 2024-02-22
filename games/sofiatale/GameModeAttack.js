import GameMode from "./GameMode.js";

let MDog;
let timeFactor;


let screen;

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

let attackID = Math.floor(Math.random()*2);

class GameModeAttack extends GameMode {
    constructor(TempMDog, playerStats) {
        super(TempMDog, playerStats);

        MDog = TempMDog;
        timeFactor = 160 / MDog.ticksPerSecond;

        screen = {width: MDog.Draw.getScreenWidthInArtPixels(), height: MDog.Draw.getScreenHeightInArtPixels()}

        this.battleBox = new BattleBox(this, Math.floor(screen.width/2), 256, 5, 5);

        this.mode = new PickingMode(this);

        MDog.Draw.setBackgroundColor("#141414");
    }

    _main() {
        this.checkDeath();
        this.mode._update();
        this.mode._draw();
    }

    checkDeath() {
        if (!(this.mode instanceof DeadMode) && this.playerStats.health <= 0) {
            this.mode = new DeadMode(this);
        }
    }
}

class Mode {
    constructor(gameModeAttack) {
        this.gameModeAttack = gameModeAttack;
    }

    _update() {}

    _draw() {}

    drawBattleHeart() {
        return false;
    }

    getChoiceHeart() {
        return -1;
    }

    drawStats() {
        // MDog.Draw.text("lots and lots of text w yayy more text", x, y, "#ff0000", {font: "determination"});

        this.drawOptions();

        this.drawInfo();
    }

    drawInfo() {

        const y = screen.height - 66;

        MDog.Draw.text(this.gameModeAttack.playerStats.name, 22, y, "#ffffff", {font: "mars", size: 24});

        // MDog.Draw.text("LV 69", 140, screen.height - 66, "#ffffff", {font: "mars", size: 24});

        const x = 220;

        MDog.Draw.text("HP", x - 25, y + 3, "#ffffff", {font: "mars", size: 16});

        const health = this.gameModeAttack.playerStats.health;

        MDog.Draw.rectangleFill(x, y + 2, 20, 17, "#ff0000");
        MDog.Draw.rectangleFill(x, y + 2, health, 17, "#ffff00");

        MDog.Draw.text(health + " / 20", x + 30, y, "#ffffff", {font: "mars", size: 24});
    }

    drawOptions() {
        const settings = {
            width: 88, height: 33, spacingXs: [35, 40, 36], y: 5 , options:
                [
                    {name: "FIGHT", image: "sofiatale/fight-option.png"},
                    {name: "ACT", image: ""},
                    {name: "ITEM", image: ""},
                    {name: "MERCY", image: ""}
                ]
        };

        let allSpacings = 0;
        for (let i = 0; i < settings.spacingXs.length; i++) {
            allSpacings += settings.spacingXs[i];
        }
        const fullWidth = settings.options.length * settings.width + allSpacings;
        const xCenter = Math.floor(screen.width / 2);
        const x = xCenter - Math.floor(fullWidth / 2);
        const y = screen.height - settings.y - settings.height;

        for (let i = 0; i < settings.options.length; i++) {

            let color = "#ff9900";

            let spacingX = 0;
            for (let j = 0; j < i; j++) {
                spacingX += settings.spacingXs[j];
            }
            const tempX = x + i * (settings.width) + spacingX;

            if (i === this.gameModeAttack.mode.getChoiceHeart()) {
                MDog.Draw.image("sofiatale/heart.png", tempX+7, y+8);
                color = "#ffff00";
            }

            MDog.Draw.rectangle(
                tempX,
                y,
                settings.width,
                settings.height,
                color
            );
            MDog.Draw.rectangle(
                tempX+1,
                y+1,
                settings.width-2,
                settings.height-2,
                color
            );

            const textSize = 24;

            const width = MDog.Draw.measureText(settings.options[i].name, {size: textSize, font: "determination"});

            MDog.Draw.text(
                settings.options[i].name,
                tempX + settings.width - width - 3,
                y + 4,
                color,
                {size: textSize, font: "determination"}
            );

            const image = settings.options[i].image;
            if (image !== "") {
                // MDog.Draw.image(image, tempX + 1, y + 1);
            }
        }
    }
}

class DeadMode extends Mode {
    constructor(gameModeAttack) {
        super(gameModeAttack);

        this.timer = 0;

        this.explodeTime = 150;

        this.particleSystem = new MDog.FX.ParticleSystem();
    }

    _update() {
        this.timer += 1;

        if (this.timer === this.explodeTime) {

            const heart = this.gameModeAttack.battleBox.heart;

            const r = 6;

            const x = heart.x + heart.width / 2;
            const y = heart.y + heart.height / 2;

            for (let i = 0; i < 6; i++) {
                const particle = new MDog.FX.ChunkParticle(
                    Math.floor(x + Math.random() * 2 * r - r),
                    Math.floor(y + Math.random() * 2 * r - r),
                    500,
                    "#ff0000",
                    Math.random()*2-1,
                    -Math.random()*1.5,
                    {gy: 0.01, size: 2}
                );
                this.particleSystem.addParticle(particle);
            }
        }

        this.particleSystem.update();
    }

    _draw() {
        MDog.Draw.clear();

        if (this.particleSystem.isEmpty()) {
            this.gameModeAttack.battleBox.heart.draw();
        } else {
            MDog.Draw.particleSystem(this.particleSystem);
        }
    }
}

class ItemMode extends Mode {
    constructor(gameModeAttack, back) {
        super(gameModeAttack, back);
        this.back = back;
        this.selected = 0;

        this.message = "";
    }

    _update() {

        if (this.message !== "") {
            if (keyDown(keys.yes, false)) {
                this.gameModeAttack.mode = new FightingMode(this.gameModeAttack);
            }
            return;
        }

        if (keyDown(keys.yes, false)) {
            const item = this.gameModeAttack.playerStats.items[this.selected];
            this.message = item.useText;
            item.use(this.gameModeAttack);
            this.gameModeAttack.playerStats.items.splice(this.selected, 1);
            return;
        }

        if (keyDown(keys.no, false)) {
            this.gameModeAttack.mode = this.back;
            return;
        }

        const items = this.gameModeAttack.playerStats.items;

        let x = 0;
        if (keyDown(keys.left, false)) {
            x -= 2;
        }
        if (keyDown(keys.right, false)) {
            x += 2;
        }

        if (this.selected === 1 && x === -2) {
            if (items.length % 2 === 0) {
                this.selected = items.length - 1;
            } else {
                this.selected = items.length - 2;
            }
        } else {
            this.selected += x;
        }

        if (this.selected > items.length - 1) {
            this.selected = (this.selected + 10) % 2;
        }

        if (this.selected < 0) {
            this.selected = (this.selected + 10) % 2;
            this.selected += items.length - (items.length % 2) - 2;
            if (this.selected < 0) {
                this.selected = (this.selected + 10) % 2;
            }
            console.log(this.selected);
        }

        let y = 0;
        if (keyDown(keys.up, false)) {
            y -= 1;
        }
        if (keyDown(keys.down, false)) {
            y += 1;
        }

        if (y !== 0) {
            if (this.selected % 2 === 0) {
                if (this.selected !== items.length - 1) {
                    this.selected += 1;
                }
            } else {
                this.selected -= 1;
            }
        }
    }

    _draw() {
        MDog.Draw.clear();
        this.gameModeAttack.battleBox.draw();
        this.drawStats();

        if (this.message !== "") {
            drawText(this.gameModeAttack.battleBox, this.message, 0);

            return;
        }

        const items = this.gameModeAttack.playerStats.items;

        const page = Math.floor(this.selected / 4);

        for (let i = 0; i < 4; i++) {
            const item = i + page * 4;
            if (item >= items.length) {
                break;
            }

            const displayText = "* " + items[item].abbreviation;

            drawText(this.gameModeAttack.battleBox, displayText, i, this.selected === item);
        }

        let y = this.gameModeAttack.battleBox.getTopY() + 20 + 2 * 25;
        let x = this.gameModeAttack.battleBox.getX() + 53;

        drawTextWithBG(
            "PAGE " + (page + 1) + "    ",
            x,
            y);
    }


}

class MercyMode extends Mode {
    constructor(gameModeAttack, back) {
        super(gameModeAttack, back);
        this.back = back;
        this.selected = 0;

        this.message = "";
    }

    _update() {

        if (this.message !== "") {
            if (keyDown(keys.yes, false)) {
                this.gameModeAttack.mode = new FightingMode(this.gameModeAttack);
            }
            return;
        }

        if (keyDown(keys.yes, false)) {
            if (this.selected === 0) {
                if (this.gameModeAttack.battleBox.cat.rizzed) {
                    this.message = "* YOU WON!\n*You earned 0 XP and 0 gold.";
                } else {
                    this.message = "* Sbot won't let\n  you escape!";
                }
            } else {
                this.message = "Fleeing is for nerds.\nI'm taking away 1 hp for that.";
                this.gameModeAttack.playerStats.health -= 1;
            }
            return;
        }

        if (keyDown(keys.no, false)) {
            this.gameModeAttack.mode = this.back;
            return;
        }

        const items = this.gameModeAttack.playerStats.items;

        let x = 0;
        if (keyDown(keys.left, false)) {
            x -= 2;
        }
        if (keyDown(keys.right, false)) {
            x += 2;
        }

        if (this.selected === 1 && x === -2) {
            if (items.length % 2 === 0) {
                this.selected = items.length - 1;
            } else {
                this.selected = items.length - 2;
            }
        } else {
            this.selected += x;
        }

        if (this.selected > items.length - 1) {
            this.selected = (this.selected + 10) % 2;
        }

        if (this.selected < 0) {
            this.selected = (this.selected + 10) % 2;
            this.selected += items.length - (items.length % 2) - 2;
            if (this.selected < 0) {
                this.selected = (this.selected + 10) % 2;
            }
            console.log(this.selected);
        }

        let y = 0;
        if (keyDown(keys.up, false)) {
            y -= 1;
        }
        if (keyDown(keys.down, false)) {
            y += 1;
        }

        if (y !== 0) {
            if (this.selected % 2 === 0) {
                if (this.selected !== items.length - 1) {
                    this.selected += 1;
                }
            } else {
                this.selected -= 1;
            }
        }
    }

    _draw() {
        MDog.Draw.clear();
        this.gameModeAttack.battleBox.draw();
        this.drawStats();

        if (this.message !== "") {
            drawText(this.gameModeAttack.battleBox, this.message, 0);
            return;
        }

        const items = this.gameModeAttack.playerStats.items;

        const page = Math.floor(this.selected / 4);

        let mercyColor = "#ffffff";

        if (this.gameModeAttack.battleBox.cat.rizzed) {
            mercyColor = "#ffff00";
        }

        drawText(this.gameModeAttack.battleBox, "* Mercy", 0, this.selected === 0, undefined, mercyColor);
        drawText(this.gameModeAttack.battleBox, "* Flee", 1, this.selected === 1);
    }
}

class TalkMode extends Mode {
    constructor(gameModeAttack, back) {
        super(gameModeAttack, back);
        this.back = back;
        this.selected = 0;

        this.message = ""; // penis
    }

    _update() {

        if (this.message !== "") {
            if (keyDown(keys.yes, false)) {
                this.gameModeAttack.mode = new FightingMode(this.gameModeAttack);
            }
            return;
        }

        if (keyDown(keys.yes, false)) {
            const dial = this.gameModeAttack.battleBox.cat.talkOptions[this.selected];
            this.message = dial.getText();
            return;
        }

        if (keyDown(keys.no, false)) {
            this.gameModeAttack.mode = this.back;
            return;
        }

        const dialogues = this.gameModeAttack.battleBox.cat.talkOptions;

        let x = 0;
        if (keyDown(keys.left, false)) {
            x -= 2;
        }
        if (keyDown(keys.right, false)) {
            x += 2;
        }

        if (this.selected === 1 && x === -2) {
            if (dialogues.length % 2 === 0) {
                this.selected = dialogues.length - 1;
            } else {
                this.selected = dialogues.length - 2;
            }
        } else {
            this.selected += x;
        }

        if (this.selected > dialogues.length - 1) {
            this.selected = (this.selected + 10) % 2;
        }

        if (this.selected < 0) {
            this.selected = (this.selected + 10) % 2;
            this.selected += dialogues.length - (dialogues.length % 2) - 2;
            if (this.selected < 0) {
                this.selected = (this.selected + 10) % 2;
            }
        }

        let y = 0;
        if (keyDown(keys.up, false)) {
            y -= 1;
        }
        if (keyDown(keys.down, false)) {
            y += 1;
        }

        if (y !== 0) {
            if (this.selected % 2 === 0) {
                if (this.selected !== dialogues.length - 1) {
                    this.selected += 1;
                }
            } else {
                this.selected -= 1;
            }
        }
    }

    _draw() {
        MDog.Draw.clear();
        this.gameModeAttack.battleBox.draw();
        this.drawStats();

        if (this.message !== "") {

            const split = this.message.split('\n');

            for (let i = 0; i < split.length; i++) {
                const line = split[i];
                drawText(this.gameModeAttack.battleBox, line, i, undefined, 3);
            }

            return;
        }

        const dialogues = this.gameModeAttack.battleBox.cat.talkOptions;

        const page = Math.floor(this.selected / 4);

        for (let i = 0; i < 4; i++) {
            const item = i + page * 4;
            if (item >= dialogues.length) {
                break;
            }

            const displayText = "* " + dialogues[item].text;

            drawText(this.gameModeAttack.battleBox, displayText, i, this.selected === item);
        }

        // let y = this.gameModeAttack.battleBox.getTopY() + 20 + 2 * 25;
        // let x = this.gameModeAttack.battleBox.getX() + 53;
        //
        // drawTextWithBG(
        //     "PAGE " + (page + 1) + "    ",
        //     x,
        //     y);
    }
}

class TextMode extends Mode {
    constructor(gameModeAttack, text, nextMode, prevMode) {
        super(gameModeAttack);
        this.text = text;
        this.nextMode = nextMode;
        this.prevMode = prevMode ?? null;
    }

    _draw() {
        MDog.Draw.clear();
        this.gameModeAttack.battleBox.draw();
        this.drawStats();

        let text = this.text;

        let heart = undefined;

        let color = "#ffffff";

        if (text.startsWith("?")) {

            heart = true;

            text = "" + text.substring(1);

            MDog.Draw.rectangleFill(
                this.gameModeAttack.battleBox.getX() + 10 - 2 - 30,
                this.gameModeAttack.battleBox.getTopY() + 21 - 2,
                80 + 4,
                14 + 4,
                "#000000"
            );

            MDog.Draw.rectangleFill(
                this.gameModeAttack.battleBox.getX() + 10 - 30,
                this.gameModeAttack.battleBox.getTopY() + 21,
                80,
                14,
                "#00ff00"
            );

            color = "#ffff00";
        }

        const fontSize = 24;

        drawText(this.gameModeAttack.battleBox, text, 0, heart, 2, color);
    }

    _update() {
        if (keyDown(keys.yes, false)) {
            this.gameModeAttack.mode = this.nextMode;
        }
        if (keyDown(keys.no) && this.prevMode != null) {
            this.gameModeAttack.mode = this.prevMode;
        }
    }
}

class AttackingMode extends Mode {
    constructor(gameModeAttack) {
        super(gameModeAttack);
        this.speed = 2;
        this.xPos = 0;
        this.done = false;
        this.timer = 0;
        this.shakeRate = 15;
        this.shakes = 3; // TODO what is this?
        this.flashRate = 15;

        this.imageWidth = 82;
        this.imageHeight = 45;
        this.imageWidthStretch = 5;
        this.imageHeightStretch = 2;

        // this.gameModeAttack.battleBox.animate(
        //     60,
        //     null,
        //     null,
        //     this.imageWidth*this.imageWidthStretch+this.spacing*2,
        //     this.imageHeight*this.imageHeightStretch+this.spacing*2);
    }

    _update() {
        this.gameModeAttack.battleBox.update();
        if (this.gameModeAttack.battleBox.doneMoving()) {
            if (!this.done) {
                this.xPos += this.speed;
            } else {
                this.timer += 1;
            }

            if (keyDown(keys.yes, false)) {
                this.done = true;
            }
        }

        if (this.checkOver()) {
            this.gameModeAttack.mode = new FightingMode(this.gameModeAttack);
            MDog.Draw.translate(0, 0);
            // this.gameModeAttack.mode = new TextMode(this.gameModeAttack, "*   Mow  bitch.", );

        }
    }

    checkOver() {
        return this.timer >= 60;
    }

    _draw() {
        MDog.Draw.clear();

        const battleBox = this.gameModeAttack.battleBox;

        battleBox.draw();

        if (battleBox.doneMoving()) {
            MDog.Draw.image(
                "sofiatale/battlegrid.png",
                battleBox.getX() - Math.floor(this.imageWidth*this.imageWidthStretch/2),
                battleBox.getY() - Math.floor(this.imageHeight*this.imageHeightStretch/2),
                {scaleX: this.imageWidthStretch, scaleY: this.imageHeightStretch}
            );

            let color1 = "#000000";
            let color2 = "#ffffff";

            if (this.done && Math.floor(this.timer/this.shakeRate)%2 === 1) {
                MDog.Draw.translate(-2, -2);
            } else {
                MDog.Draw.translate(0, 0);
            }

            if (this.checkOver()) {
                MDog.Draw.translate(0, 0);
            }

            if (Math.floor(this.timer/this.flashRate)%2 === 1) {
                color1 = "#ffffff";
                color2 = "#000000";
            }

            const barWidth = 12;
            MDog.Draw.rectangleFill(
                Math.floor(this.xPos) + battleBox.getX() - Math.floor(battleBox.getWidth() / 2) - Math.floor(barWidth/2),
                battleBox.getY() - Math.floor(battleBox.getHeight() / 2),
                barWidth,
                battleBox.getHeight(),
                color1
            );

            MDog.Draw.rectangleFill(
                Math.floor(this.xPos) + battleBox.getX() - Math.floor(battleBox.getWidth() / 2) - Math.floor(barWidth/2) + Math.floor(barWidth/4),
                battleBox.getY() - Math.floor(battleBox.getHeight() / 2) + Math.floor(barWidth/4),
                Math.floor(barWidth/2),
                battleBox.getHeight() - Math.floor(barWidth/2),
                color2
            );

        }

        this.drawStats();
    }
}

class FightingMode extends Mode {
    constructor(gameModeAttack) {
        super(gameModeAttack);

        this.spawnedAttack = false;

        // const rnd = Math.floor(Math.random()*2);

        attackID += 1;

        if (attackID % 2 === 0) {
            this.attack = "cup";
            this.gameModeAttack.battleBox.animate(100, null, null, 200, null);
            this.gameModeAttack.battleBox.setDialogue("mow", 200);
            this.gameModeAttack.battleBox.cat.mood = CatMood.Cup;
        } else if (attackID % 2 === 1) {
            this.attack = "yarn";
            this.gameModeAttack.battleBox.animate(100, null, null, 200, null);
        }

        this.iFrames = 0;
        this.maxIFrames = 120;
    }

    drawBattleHeart() {
        return true;
    }

    _update() {

        if (this.iFrames > 0) {
            this.iFrames -= 1;
        }

        if (this.gameModeAttack.battleBox.doneMoving()) {
            if (!this.spawnedAttack && this.attack === "yarn" && this.gameModeAttack.battleBox.doneMoving()) {
                this.gameModeAttack.battleBox.addAttack(new YarnAttack(this.gameModeAttack));
                this.spawnedAttack = true;
            }
        }

        this.gameModeAttack.battleBox.update();
    }

    _draw() {
        MDog.Draw.clear();

        this.gameModeAttack.battleBox.draw();

        this.drawStats();
    }
}

class PickingMode extends Mode {
    constructor(gameModeAttack) {
        super(gameModeAttack);
        this.choice = 0;

        this.gameModeAttack.battleBox.animate(100, null, null, 452, 104);
    }

    getChoiceHeart() {
        return this.choice;
    }

    _update() {
        this.gameModeAttack.battleBox.update();

        if (keyDown(keys.left, false)) {
            this.choice = (this.choice - 1 + 4) % 4;
        }
        if (keyDown(keys.right, false)) {
            this.choice = (this.choice + 1) % 4;
        }
        if (keyDown(keys.yes, false) && this.gameModeAttack.battleBox.doneMoving()) {
            const back = this;
            if (this.choice === 0) {
                const att = new AttackingMode(this.gameModeAttack);
                this.gameModeAttack.mode = new TextMode(this.gameModeAttack, "?* Sbot", att, back);
            } else if (this.choice === 1) {
                this.gameModeAttack.mode = new TalkMode(this.gameModeAttack, back);
            } else if (this.choice === 2) {
                this.gameModeAttack.mode = new ItemMode(this.gameModeAttack, back);
            } else if (this.choice === 3) {
                this.gameModeAttack.mode = new MercyMode(this.gameModeAttack, back);
            }
        }
    }

    _draw() {
        // MDog.Draw.clear({color: "#be0505"});
        MDog.Draw.clear();

        const battleBox = this.gameModeAttack.battleBox;

        battleBox.draw();

        this.drawStats();

        if (battleBox.doneMoving()) {
            drawText(battleBox, "* Bark bark!", 0);
        }
    }
}


function drawText(battleBox, text, i, hI, wrap, color) {

    wrap = wrap ?? 2;
    color = color ?? "#ffffff";

    let x = battleBox.getLeftX() + 50;
    let y = battleBox.getTopY() + 19 + (i % wrap) * 25;

    if (hI === undefined) {
        x = battleBox.getLeftX() + 18;
    }

    if (i >= wrap) {
        x = battleBox.getX() + 16;

        if (hI === undefined) {
            x = battleBox.getX() - 16; // TODO this is a little weird
        }
    }

    drawTextWithBG(text, x, y, color);

    if (hI === true) {
        MDog.Draw.image(
            "sofiatale/heart.png",
            x - 32,
            y - 2);
    }
}

function drawTextWithBG(text, x, y, color) {

    color = color ?? "#ffffff";

    const fontSize = 24;

    const width = MDog.Draw.measureText(text, {size: fontSize, font: "determination"});

    // MDog.Draw.rectangleFill(x - 2, y - 2, width + 4, 15 + 12, "#000000");

    MDog.Draw.text(
        text,
        x,
        y - 4,
        color,
        {size: fontSize, font: "determination"});
}


class Heart {
    constructor(gameModeAttack, x, y) {

        this.gameModeAttack = gameModeAttack;

        this.x = x;
        this.y = y;

        this.width = 16;
        this.height = 16;

        this.x -= Math.floor(this.width/2);
        this.y -= Math.floor(this.height/2);
    }

    draw() {

        let image = "sofiatale/heart.png";

        if (this.gameModeAttack.mode instanceof FightingMode) {
            if (this.gameModeAttack.mode.iFrames > 0) {
                if (Math.floor(this.gameModeAttack.mode.iFrames/15)%2 === 0) {
                    image = "sofiatale/heart.png";
                } else {
                    image = "sofiatale/heart-dark.png";
                }
            }
        }

        MDog.Draw.image(image, this.getX(), this.getY());

        // const col = new MDog.Math.Vector(256/2, 256/2);
        //
        // MDog.Draw.point(col.getX(), col.getY(), "#ff00ff");
        //
        // if (pointCollide(col.getX(), col.getY(), this.getX()+this.width/2, this.getY()+this.width/2, this.width/2)) {
        //     MDog.Draw.setBackgroundColor("#ff0000");
        // } else {
        //     MDog.Draw.setBackgroundColor("#00ff00");
        // }
    }

    getX() {
        return Math.floor(this.x);
    }

    getY() {
        return Math.floor(this.y);
    }

    getXCenter() {
        return Math.floor(this.x + this.width/2);
    }

    getYCenter() {
        return Math.floor(this.y + this.height/2);
    }
}

class LerpItem {
    constructor(value) {
        this.value = value;
        this.goal = value;
        this.start = value;
        this.frame = 0;
        this.animFrame = 0;
    }

    doneMoving() {
        return this.value === this.goal;
    }

    update() {
        if (this.frame >= this.animFrame) {
            this.frame = this.animFrame;
            this.value = this.goal;
            this.start = this.goal;
        } else {
            this.frame += 1;
            const t = this.frame / this.animFrame;

            this.value = Math.floor(MDog.Math.lerp(this.start, this.goal, t));
        }
    }

    animate(frames, goal) {
        this.frame = 0;
        this.animFrame = frames;

        this.goal = goal;
        this.start = this.value;
    }
}

const CatMood = {
    Normal: 0,
    Cup: 1,
    Yarn: 2,
    Rizzed: 3,
}

class Cat {
    constructor(battleBox) {
        this.battleBox = battleBox;

        this.catScale = 3;

        this.catnipped = false;
        this.rizzed = false;

        // this.health =

        this.animations = {
            head: new MDog.Draw.SpriteSheetAnimation("sofiatale/cat/faces.png", 4, 0, 45),
            tail: new MDog.Draw.SpriteSheetAnimation("sofiatale/cat/tail.png", 4, Math.floor(timeFactor*3), 30),
            back: new MDog.Draw.SpriteSheetAnimation("sofiatale/cat/back.png", 2, 1, 19),
            cup: new MDog.Draw.SpriteSheetAnimation("sofiatale/cat/cup.png", 4, 3, 47),
            yarn: new MDog.Draw.SpriteSheetAnimation("sofiatale/cat/yarn_cat.png", [0, 1, 0, 1, 0, 2, 0, 2], 3, 91),
        }

        this.mood = CatMood.Normal;
        // this.mood = CatMood.Rizzed;

        this.spawnedCup = false;

        this.talkOptions = [
                new this.TalkOptionCheck(this),
                new this.TalkOptionMeow(this),
                new this.TalkOptionRizz(this),
            ];
    }

    TalkOption = class {
        constructor(cat, text) {
            this.cat = cat;
            this.text = text;
        }
        getText() {
            return "You forgot to set the\ntext for this one\n>:(";
        }
    }

    TalkOptionCheck = class extends this.TalkOption {

        constructor(cat) {
            super(cat, "Check")
        }

        getText() {
            return "* SBOT - ATK 8 DEF 8\n* I've never seen anyone\n  use the check feature."
        }
    }

    TalkOptionMeow = class extends this.TalkOption {

        count = 0;
        texts = [
            "Sbot tells you not to\nbe so vulgar.",
            "Sbot once again tells\nyou off for saying\nsuch terrible words.",
            "Sbot glares at you.",
            "Sbot looks hurt."
        ];

        constructor(cat) {
            super(cat, "Meow")
        }

        getText() {
            const phrase = this.texts[this.count];

            this.count += 1;

            if (this.count > this.texts.length) {
                this.count = 0;
            }

            return phrase;
        }
    }

    TalkOptionRizz = class extends this.TalkOption {

        constructor(cat) {
            super(cat, "Rizz")
        }

        getText() {
            if (this.cat.catnipped) {
                this.cat.rizzed = true;
                this.cat.mood = CatMood.Rizzed;
                // TODO make cat rizzed animation
                return "Aeugh >w<";
            }
            return "Sbot gives you the\ncold shoulder.";
        }
    }

    draw() {

        const battleBox = this.battleBox;

        const x = battleBox.getX();
        const y = battleBox.getY() - Math.floor(battleBox.getHeight() / 2) - this.catScale * 30 + 2;

        if (battleBox.dialogueTimer > 0) {

            const x1 = -130;
            const y1 = -20;
            const x2 = -20;
            const y2 = 60;

            const r = 10;

            // MDog.Draw.rectangleFill(x+x1, y+y1, x2-x1, y2-y1, "#ffff00");

            MDog.Draw.circle(x+x1 + r, y+y1 + r, r, "#ffffff");
            MDog.Draw.circle(x+x1 + r, y+y2 - r, r, "#ffffff");
            MDog.Draw.circle(x+x2 - r, y+y1 + r, r, "#ffffff");
            MDog.Draw.circle(x+x2 - r, y+y2 - r, r, "#ffffff");

            MDog.Draw.rectangleFill(x+x1 + r, y+y1, x2-x1 - 2*r, y2-y1, "#ffffff");
            MDog.Draw.rectangleFill(x+x1, y+y1 + r, x2-x1, y2-y1 - 2*r, "#ffffff");

            const blipHeight = 11;
            const blipWidth = 10;
            const blipY = 50;

            //Math.floor((y1+y2)/2)+i-Math.floor(blipHeight/2)

            for (let i = 0; i < blipHeight; i++) {
                MDog.Draw.line(
                    x+x2-1,
                    y+y1+blipY+i-Math.floor(blipHeight/2),
                    x+x2+blipWidth,
                    y+y1+blipY,
                    "#ffffff");
            }

            MDog.Draw.text(battleBox.dialogueText, x+Math.floor((x1+x2)/2), y+Math.floor((y1+y2)/2)-3, "#000000", {size: 16*3, font: "determination", textAlign: "center", textBaseline: "middle"});
        }

        // if (MDog.Input.Keyboard.isDown("q")) {
        //     this.mood = CatMood.Normal;
        // } else {
        //     this.mood = CatMood.Rizzed;
        // }

        if (this.mood === CatMood.Yarn) {
            if (this.battleBox.attacks.length === 0) {
                this.mood = CatMood.Normal;
            }
        }

        if (this.mood === CatMood.Normal) {
            this.drawNormalCat(x, y);
        }

        if (this.mood === CatMood.Cup) {
            if (this.battleBox.dialogueTimer !== 0) {
                this.drawNormalCat(x, y);
            } else {
                this.drawCupCat(x, y);
                if (this.animations.cup.getRawFrame() >= this.animations.cup.frames) {
                    this.mood = CatMood.Normal;
                    this.animations.cup.reset();
                    this.spawnedCup = false;
                }
                if (this.animations.cup.getRawFrame() === this.animations.cup.frames - 1 &&
                    !this.spawnedCup) {
                    this.spawnedCup = true;
                    battleBox.addAttack(new CupAttack(this.battleBox.gameModeAttack));
                    this.battleBox.gameModeAttack.mode.spawnedAttack = true;
                }
            }
        }

        if (this.mood === CatMood.Yarn) {
            MDog.Draw.animation(this.animations.yarn, x - 3*15-1, y - 27, {scale: this.catScale});
        }

        if (this.mood === CatMood.Rizzed) {
            MDog.Draw.image("sofiatale/rawfiles/hardcat.png", x, y, {scale: this.catScale});
        }

        if (MDog.Input.Keyboard.isDown(" ")) {
            // MDog.Draw.image("sofiatale/cat.png", battleBox.getX(), battleBox.getY() - Math.floor(battleBox.getHeight() / 2) - this.catScale * 30 + 2, {scale: this.catScale});
            // this.mood = 1;
        }
    }

    drawNormalCat(x, y) {
        MDog.Draw.image("sofiatale/cat/body.png", x, y, {scale: this.catScale});

        MDog.Draw.animation(this.animations.tail, x + 75, y + 54, {scale: this.catScale})
        MDog.Draw.animation(this.animations.back, x + 66, y + 27, {scale: this.catScale});
        MDog.Draw.animation(this.animations.head, x, y, {scale: this.catScale});
    }

    drawCupCat(x, y) {
        MDog.Draw.animation(this.animations.cup, x - 3, y - 33, {scale: this.catScale})
        MDog.Draw.animation(this.animations.tail, x + 75, y + 54, {scale: this.catScale})
    }


}

class BattleBox {
    constructor(gameModeAttack, x, y, width, height) {
        this.gameModeAttack = gameModeAttack;
        this.x = new LerpItem(x);
        this.y = new LerpItem(y);
        this.width = new LerpItem(width);
        this.height = new LerpItem(height);

        this.heart = new Heart(this.gameModeAttack, this.getX(), this.getX());

        this.attacks = [];

        this.dialogueTimer = 0;
        this.dialogueText = "";

        this.cat = new Cat(this);
    }

    setDialogue(text, timer) {
        this.dialogueText = text;
        this.dialogueTimer = timer;
    }

    doneMoving() {
        return this.x.doneMoving() && this.y.doneMoving() && this.width.doneMoving() && this.height.doneMoving();
    }

    getX() {
        return this.x.value;
    }

    getLeftX() {
        return this.getX() - Math.floor(this.getWidth()/2);
    }

    getRightX() {
        return this.getX() + Math.floor(this.getWidth()/2);
    }

    getXGoal() {
        return this.x.goal;
    }

    getY() {
        return this.y.value;
    }

    getTopY() {
        return this.getY() - Math.floor(this.getHeight()/2);
    }

    getBottomY() {
        return this.getY() + Math.floor(this.getHeight()/2);
    }

    getYGoal() {
        return this.y.goal;
    }

    getWidth() {
        return this.width.value;
    }

    getWidthGoal() {
        return this.width.goal;
    }

    getHeight() {
        return this.height.value;
    }

    getHeightGoal() {
        return this.height.goal;
    }

    getAttacks() {
        return this.attacks;
    }

    addAttack(attack) {
        this.attacks.push(attack)
    }

    update() {

        if (this.dialogueTimer > 0) {
            this.dialogueTimer -= 1;
        }
        this.updateSize();
        if (this.gameModeAttack.mode.drawBattleHeart()) {
            this.updateHeart();
            if (this.doneMoving()) {
                this.updateAttacks();
            }
        }
    }

    updateAttacks() {

        const attacksToRemove = [];

        for (let i = 0; i < this.getAttacks().length; i++) {
            const attack = this.getAttacks()[i];
            attack.update();

            if (attack.checkDeath()) {
                attacksToRemove.push(i);
            }

        }

        for (let i = attacksToRemove.length - 1; i >= 0; i--) {
            this.attacks.splice(attacksToRemove[i], 1);
        }

        const gma = this.gameModeAttack;

        if (this.attacks.length === 0 && this.cat.mood === CatMood.Normal && this.dialogueTimer === 0 && gma.mode.spawnedAttack) {
            gma.mode = new PickingMode(gma);
            // gma.battleBox.cat.mood = 0;
        }
    }

    updateHeart() {

        let move = new MDog.Math.Vector(0, 0);

        let moveSpeed = 1;

        if (keyDown(keys.up)) {
            move.y -= moveSpeed;
        }
        if (keyDown(keys.down)) {
            move.y += moveSpeed;
        }
        if (keyDown(keys.left)) {
            move.x -= moveSpeed;
        }
        if (keyDown(keys.right)) {
            move.x += moveSpeed;
        }

        const heart = this.heart;

        heart.x += move.getX();
        heart.y += move.getY();

        if (heart.x < this.getX()-Math.floor(this.getWidth()/2)) {
            heart.x = this.getX()-Math.floor(this.getWidth()/2)
        }
        if (heart.y < this.getY()-Math.floor(this.getHeight()/2)) {
            heart.y = this.getY()-Math.floor(this.getHeight()/2)
        }
        if (heart.x > this.getX()+Math.floor(this.getWidth()/2)-heart.width) {
            heart.x = this.getX()+Math.floor(this.getWidth()/2)-heart.width
        }
        if (heart.y > this.getY()+Math.floor(this.getHeight()/2)-heart.height) {
            heart.y = this.getY()+Math.floor(this.getHeight()/2)-heart.height
        }
    }

    updateSize() {
        this.x.update();
        this.y.update();
        this.width.update();
        this.height.update();
    }

    animate(frames, goalX, goalY, goalWidth, goalHeight) {
        if (goalX != null) {
            this.x.animate(frames, goalX);
        }
        if (goalY != null) {
            this.y.animate(frames, goalY);
        }
        if (goalWidth != null) {
            this.width.animate(frames, goalWidth);
        }
        if (goalHeight != null) {
            this.height.animate(frames, goalHeight);
        }
    }

    draw() {

        // 3 -> 92
        // 2 -> 62

        this.drawBox();

        this.cat.draw();

        if (this.gameModeAttack.mode.drawBattleHeart()) {
            if (this.doneMoving()) {
                this.drawAttacks();
            }
            this.heart.draw();
        }
    }

    drawAttacks() {
        for (let i = 0; i < this.getAttacks().length; i++) {
            const attack = this.getAttacks()[i];
            attack.draw();
        }
    }

    drawBox() {
        let x = this.getX() - Math.floor(this.getWidth()/2);
        let y = this.getY() - Math.floor(this.getHeight()/2);

        const width = 4;
        for (let i = 1; i <= width; i++) {
            MDog.Draw.rectangle(x - i, y - i, this.getWidth() + i*2, this.getHeight() + i*2, "#ffffff");
        }
    }
}

class ModeAttack {
    constructor(gameModeAttack) {
        this.gameModeAttack = gameModeAttack;
    }

    update() {}

    draw() {}

    checkDeath() {
        console.log("Using Attack class checkDeath() function!");
        return false;
    }
}

class CupAttack extends ModeAttack {
    constructor(gameModeAttack) {
        super(gameModeAttack);

        const vel = new MDog.Math.Vector(-0.1, -1.2);

        this.cup = new Cup(this.gameModeAttack,112, -20, vel.getX(), vel.getY());
        // this.cups.push(new Cup(0, 40, vel.getX(), vel.getY()));
        // this.cups.push(new Cup(0, 100, vel.getX(), vel.getY()));

    }

    checkDeath() {
        return this.cup.checkDeath(); // this.cups.checkDeath();
    }

    update() {
        // for (let i = 0; i < this.cups.length; i++) {
        //     this.cups[i].update();
        // }
        this.cup.update();
    }

    draw() {
        // for (let i = 0; i < this.cups.length; i++) {
        //     this.cups[i].draw();
        // }
        this.cup.draw();
    }
}

class Cup {
    constructor(gameModeAttack, x, y, vx, vy) {
        this.gameModeAttack = gameModeAttack;
        this.diam = 18;
        this.r = this.diam/2;
        this.pos = new MDog.Math.Vector(x, y);
        const battleBox = this.gameModeAttack.battleBox;
        this.pos.x += battleBox.getX()-Math.floor((battleBox.getWidth())/2)+this.getR();
        this.pos.y += battleBox.getY()-Math.floor((battleBox.getHeight())/2)+this.getR();

        this.velocity = new MDog.Math.Vector(vx, vy);

        // 0.02

        this.g = 0.04;

        this.bounces = 0;
    }

    getR() {
        return this.r;
    }

    update() {
        const battleBox = this.gameModeAttack.battleBox;

        this.velocity.y += this.g;

        this.pos.add(this.velocity);

        if (this.pos.getX() < battleBox.getX()-Math.floor((battleBox.getWidth())/2)+this.getR()) {
            this.pos.setX(battleBox.getX()-Math.floor((battleBox.getWidth())/2)+this.getR());
            this.velocity.setX(Math.abs(this.velocity.getX()))
        }
        // if (this.pos.getY() < battleBox.getY()-Math.floor((battleBox.getHeight())/2)+this.getR()) {
        //     this.pos.setY(battleBox.getY()-Math.floor((battleBox.getHeight())/2)+this.getR());
        //     this.velocity.setY(Math.abs(this.velocity.getY()))
        // }
        if (this.pos.getX() > battleBox.getX()+Math.floor((battleBox.getWidth())/2)-this.getR()) {
            this.pos.setX(battleBox.getX()+Math.floor((battleBox.getWidth())/2)-this.getR());
            this.velocity.setX(-Math.abs(this.velocity.getX()))
        }
        if (this.pos.getY() > battleBox.getY()+Math.floor((battleBox.getHeight())/2)-this.getR()) {
            if (this.velocity.getY() >= 0) {
                if (this.bounces <= 10) {
                    this.pos.setY(battleBox.getY() + Math.floor((battleBox.getHeight()) / 2) - this.getR());

                    this.calculateVelocity();

                    this.bounces += 1;
                }
            }
        }

        let hit = false;

        const heart = battleBox.heart;
        hit = hit || pointCollide(this.pos.getX(), this.pos.getY(), heart.getXCenter(), heart.getYCenter(), heart.width/2 + this.r);

        if (hit && this.gameModeAttack.mode.iFrames === 0) {
            this.gameModeAttack.playerStats.health -= 4
            this.gameModeAttack.mode.iFrames = this.gameModeAttack.mode.maxIFrames;
        }
    }

    calculateVelocity() {
        const battleBox = this.gameModeAttack.battleBox;
        const heart = battleBox.heart;
        const h = battleBox.getHeight();
        this.g += 0.01;
        const g = this.g;
        const xc = this.pos.getX();
        const yc = battleBox.getBottomY() - this.pos.getY();
        const x1 = heart.getXCenter();
        const y1 = battleBox.getBottomY() - heart.getYCenter();

        const v0 = Math.sqrt(2*g*h);
        const bp = 0.95;
        const y0 = v0*Math.sqrt(bp-(yc/h));

        const beforeSqrt = (x1-xc)*y0;
        const leftOfMinusInSqrt = ((x1-xc)**2)*(y0**2);
        const rightOfMinusInSqrt = 2*(y1-yc)*g*((x1-xc)**2);

        const inSqrt = leftOfMinusInSqrt-rightOfMinusInSqrt

        if (inSqrt < 0) {
            this.velocity.setX(0);
            this.velocity.setY(-y0);
            return;
        }

        const afterSqrt = (2*(y1-yc));

        let x0P = (beforeSqrt+Math.sqrt(inSqrt))/afterSqrt;
        let x0M = (beforeSqrt-Math.sqrt(inSqrt))/afterSqrt;

        let x0 = 0;

        if (Math.abs(x0P) < Math.abs(x0M)) {
            x0 = x0P;
        } else { //} if (Math.abs(x0M) < Math.abs(x0P)) {
            x0 = x0M;
        }

        this.velocity.setX(x0);
        this.velocity.setY(-y0);

    }

    checkDeath() {
        return this.pos.getY() > screen.height;
    }

    draw() {

        MDog.Draw.image("sofiatale/cat/actual_cup_lol.png", Math.floor(this.pos.x - this.r) - 6, Math.floor(this.pos.y - this.r) - 3, {scale: 3}); // TODO fix the -3 on the x, this is bad
        // MDog.Draw.rectangleFill(Math.floor(this.pos.x), Math.floor(this.pos.y), 1, 1, "#ff00ff");
        //
        // MDog.Draw.rectangle(
        //     Math.floor(this.pos.x - this.r),
        //     Math.floor(this.pos.y - this.r),
        //     this.getR()*2,
        //     this.getR()*2,
        //     "#ff0000"
        // )
    }
}

class YarnAttack extends ModeAttack {
    constructor(gameModeAttack) {
        super(gameModeAttack);

        const battleBox = this.gameModeAttack.battleBox;

        const vel = new MDog.Math.Vector(1.5, 1);
        vel.normalize();

        const rnd = Math.floor(Math.random()*6);
        const rndX = Math.floor(Math.random()*2)*2-1
        if (rnd === 0) {
            this.yarnBall = new YarnBall(this.gameModeAttack, 1, 1, vel.getX(), vel.getY());
        } else if (rnd === 1) {
            this.yarnBall = new YarnBall(this.gameModeAttack, battleBox.getWidthGoal()-14, 1, -vel.getX(), vel.getY());
        } else if (rnd === 2) {
            this.yarnBall = new YarnBall(this.gameModeAttack, 1, battleBox.getHeightGoal()-14, vel.getX(), -vel.getY());
        } else if (rnd === 3) {
            this.yarnBall = new YarnBall(this.gameModeAttack, battleBox.getWidthGoal()-14, battleBox.getHeightGoal()-14, -vel.getX(), -vel.getY());
        } else if (rnd === 4) {
            this.yarnBall = new YarnBall(this.gameModeAttack, Math.floor((battleBox.getWidthGoal()-14)/2), 0, vel.getX()*rndX, vel.getY());
        } else {
            this.yarnBall = new YarnBall(this.gameModeAttack, Math.floor((battleBox.getWidthGoal()-14)/2), battleBox.getHeightGoal()-14, vel.getX()*rndX, -vel.getY());
        }

        this.gameModeAttack.battleBox.cat.mood = CatMood.Yarn;
    }

    checkDeath() {
        return this.yarnBall.checkDeath();
    }

    update() {
        this.yarnBall.update();
    }

    draw() {
        this.yarnBall.draw();
    }
}

class YarnBall {
    constructor(gameModeAttack, x, y, vx, vy) {
        this.gameModeAttack = gameModeAttack;
        const battleBox = this.gameModeAttack.battleBox;
        this.diam = 14;
        this.r = this.diam/2;
        this.pos = new MDog.Math.Vector(x, y);
        this.pos.x += battleBox.getXGoal()-Math.floor((battleBox.getWidthGoal())/2)+this.getR();
        this.pos.y += battleBox.getYGoal()-Math.floor((battleBox.getHeightGoal())/2)+this.getR();

        this.velocity = new MDog.Math.Vector(vx, vy);

        this.lines = [new MDog.Math.Vector(this.pos.getX(), this.pos.getY())];

        this.speed = 0;
        this.acc = 0.01;
    }

    getR() {
        return this.r;
    }

    update() {
        const battleBox = this.gameModeAttack.battleBox;

        if (this.speed < 1) {
            this.speed += this.acc;
        }
        if (this.speed > 1) {
            this.speed = 1;
        }

        this.pos.add(this.velocity.clone().multiply(this.speed));

        const velSave = this.velocity.clone();

        if (this.pos.getX() < battleBox.getX()-Math.floor((battleBox.getWidth())/2)+this.getR()) {
            this.pos.setX(battleBox.getX()-Math.floor((battleBox.getWidth())/2)+this.getR());
            this.velocity.setX(Math.abs(this.velocity.getX()))
        }
        if (this.pos.getY() < battleBox.getY()-Math.floor((battleBox.getHeight())/2)+this.getR()) {
            this.pos.setY(battleBox.getY()-Math.floor((battleBox.getHeight())/2)+this.getR());
            this.velocity.setY(Math.abs(this.velocity.getY()))
        }
        if (this.pos.getX() > battleBox.getX()+Math.floor((battleBox.getWidth())/2)-this.getR()) {
            this.pos.setX(battleBox.getX()+Math.floor((battleBox.getWidth())/2)-this.getR());
            this.velocity.setX(-Math.abs(this.velocity.getX()))
        }
        if (this.pos.getY() > battleBox.getY()+Math.floor((battleBox.getHeight())/2)-this.getR()) {
            this.pos.setY(battleBox.getY()+Math.floor((battleBox.getHeight())/2)-this.getR());
            this.velocity.setY(-Math.abs(this.velocity.getY()))
        }

        if (this.velocity.getX() !== velSave.getX() || this.velocity.getY() !== velSave.getY()) {
            this.newLine();

            const change = 15;

            this.velocity.x += (Math.random()-0.5)/change;
            this.velocity.y += (Math.random()-0.5)/change;
            this.velocity.normalize();
        }

        let hit = false;

        if (this.gameModeAttack.mode.iFrames === 0) {

            let damage = 0;

            if (this.detectLineCollide()) {
                damage = 1;
            }

            if (this.detectBallCollide()) {
                damage = 4;
            }

            if (damage !== 0) {
                this.gameModeAttack.playerStats.health -= damage;
                this.gameModeAttack.mode.iFrames = this.gameModeAttack.mode.maxIFrames;
            }
        }
    }

    detectBallCollide() {

        const battleBox = this.gameModeAttack.battleBox;
        const heart = battleBox.heart;

        return pointCollide(this.pos.getX(), this.pos.getY(), heart.getXCenter(), heart.getYCenter(), heart.width / 2 + this.getR())
    }

    detectLineCollide() {
        let hit = false;

        const battleBox = this.gameModeAttack.battleBox;
        const heart = battleBox.heart;

        const l = this.lines[this.lines.length - 1];
        hit = hit || lineCollide(l.getX(), l.getY(), this.pos.getX(), this.pos.getY(), heart.getXCenter(), heart.getYCenter(), heart.width / 2);

        for (let i = 0; i < this.lines.length - 1; i++) {
            if (hit) {
                break;
            }
            const l1 = this.lines[i];
            const l2 = this.lines[i + 1];
            hit = hit || lineCollide(l1.getX(), l1.getY(), l2.getX(), l2.getY(), heart.getXCenter(), heart.getYCenter(), heart.width / 2);
        }

        return hit;
    }

    checkDeath() {
        return this.lines.length >= 14;
    }

    newLine() {
        this.lines.push(new MDog.Math.Vector(this.pos.getX(), this.pos.getY()));
    }

    draw() {
        for (let i = 0; i < this.lines.length-1; i++) {
            const l1 = this.lines[i];
            const l2 = this.lines[i+1];
            MDog.Draw.line(l1.getX(), l1.getY(), l2.getX(), l2.getY(), "#ffffff");
        }
        const l = this.lines[this.lines.length-1];
        MDog.Draw.line(l.getX(), l.getY(), this.pos.getX(), this.pos.getY(), "#ffffff");

        MDog.Draw.image(
            "sofiatale/cat/yarn_ball.png",
            Math.floor(this.pos.x - this.r),
            Math.floor(this.pos.y - this.r));

        // MDog.Draw.rectangle(
        //     Math.floor(this.pos.x - this.r),
        //     Math.floor(this.pos.y - this.r),
        //     this.getR()*2,
        //     this.getR()*2,
        //     "#ff0000"
        // )
        // MDog.Draw.rectangleFill(this.pos.x, this.pos.y, 1, 1, "#ff00ff");
    }
}

function lineCollide(x1, y1, x2, y2, x3, y3, r) {

    x1 = Math.floor(x1);
    y1 = Math.floor(y1);
    x2 = Math.floor(x2);
    y2 = Math.floor(y2);

    let dx = Math.abs(x2 - x1);
    let dy = Math.abs(y2 - y1);
    let sx = (x1 < x2) ? 1 : -1;
    let sy = (y1 < y2) ? 1 : -1;
    let err = dx - dy;

    while(true) {
        if (pointCollide(x1, y1, x3, y3, r)) {
            return true;
        }

        if ((x1 === x2) && (y1 === y2)) break;
        let e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy; x1 += sx;
        }
        if (e2 < dx) {
            err += dx; y1 += sy;
        }
    }

    return false;
}

function pointCollide(x1, y1, x2, y2, r) {
    // const vec1 = new MDog.Math.Vector(x1, y1);
    // const vec2 = new MDog.Math.Vector(x2, y2);
    //
    // if (vec1.distanceTo(vec2) <= r) {
    //     return true;
    // }

    const x0 = x1 - x2;
    const y0 = y1 - y2;
    return x0 * x0 + y0 * y0 <= r * r;
}

export default GameModeAttack;

// TODO go back to picking when the attack ends
// TODO add cat health
// TODO add player health
// TODO add items?
// TODO button art and labels
// TODO dialauge
// TODO mousetrap
// TODO ear animation