import MDog from "./MDogMain.js"
import GameModeAttack from "./GameModeAttack.js";
import GameModeExplore from "./GameModeExplore.js";

console.log("Started!");

class Game {
    constructor() {
        this.playerStats = new PlayerStats();
        this.gameMode = new GameModeAttack(this.playerStats);
    }

    _main() {
        this.gameMode._main();
    }
}

class PlayerStats {
    constructor() {
        this.health = 10;
    }
}

const game = new Game();

MDog.setActiveFunction(game._main.bind(game));
