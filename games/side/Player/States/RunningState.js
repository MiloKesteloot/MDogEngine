import PlayerState from "./PlayerState.js";

class RunningState extends PlayerState {
    constructor(player) {
        super(player, 8, "side/girl/Run/Warrior_Run_?.png", 12);
    }
}

export default RunningState;