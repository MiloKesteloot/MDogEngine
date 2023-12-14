import PlayerState from "./PlayerState.js";

class TransitionState extends PlayerState {
    constructor(player, frames, fileName, animationSpeed, nextState) {
        super(player, frames, fileName, animationSpeed);
        this.nextState = nextState;
    }

    postDrawUpdate() {
        if (this.animation.getRawFrame() >= this.animation.frames) {
            this.player.hardSetState(this.nextState);
        }
    }
}

export default TransitionState;