import PlayerState from "./PlayerState.js";

class IdleState extends PlayerState {
    constructor(player) {
        super(player, 6, "side/girl/Idle/Warrior_Idle_?.png", 12);
    }
}

export default IdleState;