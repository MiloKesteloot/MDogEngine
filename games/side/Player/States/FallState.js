import PlayerState from "./PlayerState.js";

class FallState extends PlayerState {
    constructor(Draw, player) {
        super(Draw, player, 3, "side/girl/Fall/Warrior_Fall_?.png", 12);
    }
}

export default FallState;