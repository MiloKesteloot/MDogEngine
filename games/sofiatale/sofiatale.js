import MDog from "/MDogEngine/MDogModules/MDogMain.js"
import GameModeAttack from "./GameModeAttack.js";
import GameModeExplore from "./GameModeExplore.js";

console.log("Started!");

class Game {
    constructor() {

        const assets = "cat/actual_cup_lol, cat/back, cat/cup, cat/ears, cat/faces, cat/tail, cat/yarn_ball, cat/yarn_cat, battlegrid, cat, heart";

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
        this.health = 20;
        this.items = [
            new Item("Monster Candy", "MnstrCndy", "You ate the Monster Candy.\nYour HP was maxed out."),
            new Item("Cat Nip", "Cat Nip", "You fed the cat cat nip."),
            new Item("Cream Pie", "Cream Pie", "Ohhh yeahhh..."),
            new Item("Monster Candy", "MnstrCndy", "You ate the Monster Candy.\nYour HP was maxed out."),
            new Item("Cream Pie", "Cream Pie", "Ohhh yeahhh..."),
            new Item("Cat Nip", "Cat Nip", "You fed the cat cat nip."),
            new Item("Cream Pie", "Cream Pie", "Ohhh yeahhh..."),
        ]
    }
}

class Item {
    constructor(name, abbreviation, useText) {
        this.name = name;
        this.abbreviation = abbreviation;
        this.useText = useText;
    }
}

const game = new Game();

MDog.setActiveFunction(game._main.bind(game));
