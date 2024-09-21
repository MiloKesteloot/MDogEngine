class Kickbox {
    constructor(vector) {
        this.vector = vector;
    }

    getX() {
        return this.vector.getX();
    }
    getY(index) {
        return this.vector.getY();
    }

    colliding(otherKickbox) {
        return false;
    }
}

export default Kickbox;