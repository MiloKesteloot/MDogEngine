class Hitbox {
    constructor(vector) {
        this.vector = vector;
    }

    getX() {
        return this.vector.getX();
    }
    getY(index) {
        return this.vector.getY();
    }

    colliding(otherHitbox) {
        return false;
    }
}

export default Hitbox;