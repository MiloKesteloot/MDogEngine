class GameMode {
    constructor(MDog, playerStats) {
        this.MDog = MDog;
        this.playerStats = playerStats;
    }

    _main() {}

    getPlayerStats() {
        return this.playerStats;
    }
}

export default GameMode;