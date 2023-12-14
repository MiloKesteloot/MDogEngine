import PlayerState from "./PlayerState.js";

class JumpState extends PlayerState {
    constructor(player) {
        super(player, 3, "side/girl/Jump/Warrior_Jump_?.png", 12);
    }
}

export default JumpState;