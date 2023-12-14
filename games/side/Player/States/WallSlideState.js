import PlayerState from "./PlayerState.js";

class WallSlideState extends PlayerState {
    constructor(player) {
        super(player, 3, "side/girl/WallSlide/Warrior_WallSlide_?.png", 12 * timeFactor);
    }

    getFlipX() {
        return !this.player.facingLeft;
    }

    getXOffset() {
        return this.player.facingLeft ? 10 : -14;
    }
}

export default WallSlideState;