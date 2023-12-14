class PlayerState {
    constructor(Draw, player, frames, fileName, animationSpeed) {
        this.Draw = Draw;
        this.player = player;
        this.animation = new this.Draw.MultipleFileAnimation(fileName, frames, animationSpeed, {});
        this.Draw.preloadAnimation(this.animation);
    }

    is(stateClass) {
        return this instanceof stateClass;
    }

    getFrame() {
        return this.animation.getFrame();
    }

    canWallSlide() {
        return true;
    }

    canDashAttack() {
        return true;
    }

    canOverrideSelf() {
        return false;
    }

    postDrawUpdate() {}

    draw() {
        let xOffset = 0;
        if (this.player.facingLeft) {
            xOffset = -8;
        }
        this.Draw.animation(this.animation, this.player.getX() + xOffset + this.getXOffset(), this.player.getY(), {flipX: this.getFlipX()});
        this.postDrawUpdate();
    }

    getFlipX() {
        return this.player.facingLeft;
    }

    getXOffset() {
        return 0;
    }

    checkOverride(state) {
        return true;
    }
}

export default PlayerState;