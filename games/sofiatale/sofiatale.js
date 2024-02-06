import MDog from "/MDogEngine/MDogModules/MDogMain.js"
import GameModeAttack from "./GameModeAttack.js";
import GameModeExplore from "./GameModeExplore.js";

console.log("Started!");

class Game {
    constructor() {

        const assets = "cat/actual_cup_lol, cat/back, cat/cup, cat/ears, cat/faces, cat/tail, cat/yarn_ball, cat/yarn_cat, battlegrid, cat, heart, heart-dark";

        const split = assets.split(", ");
        for (let i = 0; i < split.length; i++) {
            MDog.Draw.image("sofiatale/" + split[i] + ".png", -1000, -1000);
        }

        this.playerStats = new PlayerStats();
        this.gameMode = new GameModeAttack(MDog, this.playerStats);
    }

    _main() {
        this.gameMode._main();
    }
}

class PlayerStats {
    constructor() {
        this.name = "roomba";

        this.maxHealth = 20;
        this.health = this.maxHealth;
        this.items = [
            new CatNip(),
            new FoodItem("Cream Pie", "Cream Pie", "Yummy yummers!", 10),
        ]
    }
}

class Item {
    constructor(name, abbreviation, useText) {
        this.name = name;
        this.abbreviation = abbreviation;
        this.useText = useText;
    }

    use(gameModeAttack) {

    }
}

class CatNip extends Item {
    constructor() {
        super("Cat Nip", "Cat Nip", "You fed the cat cat nip.");
    }

    use(gameModeAttack) {
        gameModeAttack.battleBox.cat.catnipped = true;
    }
}

class FoodItem extends Item {
    constructor(name, abbreviation, useText, health) {
        super(name, abbreviation, useText);
        this.health = health;
    }

    use(gameModeAttack) {
        gameModeAttack.playerStats.health += this.health;
        if (gameModeAttack.playerStats.health > gameModeAttack.playerStats.maxHealth) {
            gameModeAttack.playerStats.health = gameModeAttack.playerStats.maxHealth;
        }
    }
}

const game = new Game();

MDog.setActiveFunction(game._main.bind(game));
