class GameMode {
    constructor(game, MDog, playerStats) {
        this.game = game;
        this.MDog = MDog;
        this.playerStats = playerStats;
    }

    _main() {}

    getPlayerStats() {
        return this.playerStats;
    }
}

export default GameMode;