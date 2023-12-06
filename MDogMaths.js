import Module from "./MDogModule.js";

class SparseMatrix {
    constructor() {
        this.matrix = new Map();
    }

    setValue(row, col, value) {
        const key = `${row}_${col}`;
        this.matrix.set(key, value);
    }

    getValue(row, col) {
        const key = `${row}_${col}`;
        return this.matrix.get(key) || 0;
    }
}

class Vector {
    x = 0;
    y = 0;

    // new Vector()      ->   (0, 0)
    // new Vector(3)     ->   (3, 3)
    // new Vector(4, 5)  ->   (4, 5)

    constructor(x, y) {
        if (x === undefined) {
            this.x = 0;
            this.y = 0;
        } else if (y === undefined) {
            this.x = x;
            this.y = x;
        } else {
            this.x = x;
            this.y = y;
        }
    }

    toString() {
        return "(" + this.getX() + ", " + this.getY() + ")";
    }

    getX() {
        return this.x;
    }

    getY() {
        return this.y;
    }

    setX(x) {
        this.x = x;
        return this;
    }

    setY(y) {
        this.y = y;
        return this;
    }

    set(x_or_vector, y) {
        if (x_or_vector instanceof Vector) {
            this.x = x_or_vector.x;
            this.y = x_or_vector.y;
        } else {
            this.x = x_or_vector;
            this.y = y;
        }
        return this;
    }

    // Returns a new copy of this vector.
    clone() {
        return new Vector(this.x, this.y);
    }

    // Add two values or a vector to this vector.
    add(x_or_vector, y) {
        if (x_or_vector instanceof Vector) {
            this.x += x_or_vector.x;
            this.y += x_or_vector.y;
        } else {
            this.x += x_or_vector;
            this.y += y;
        }
        return this;
    }

    // Subtract two values or a vector from this vector.
    subtract(x_or_vector, y) {
        if (x_or_vector instanceof Vector) {
            this.x -= x_or_vector.x;
            this.y -= x_or_vector.y;
        } else {
            this.x -= x_or_vector;
            this.y -= y;
        }
        return this;
    }

    // Get the length of this vector.
    length() {
        return Math.sqrt(this.x*this.x + this.y*this.y);
    }

    setLength(length) {
        return this.length() === 0 ? this : this.multiply(length / this.length())
    }

    constrain(maxLength) {
        return this.length() > maxLength ? this.setLength(maxLength) : this;
    }

    // Normalize this vector.
    normalize() {
        const length = this.length();
        if (length !== 0) {
            this.x /= length;
            this.y /= length;
        }
        return this;
    }

    // Multiply this vector by a scalar.
    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    getAngle() {
        return Math.atan2(this.y, this.x) * 180 / Math.PI;
    }

    distanceTo(other) {
        return Math.sqrt(Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2));
    }

    dotProduct(other) {
        return this.x * other.x + this.y * other.y;
    }
}

class Maths extends Module {
    // static Vector = Vector;

    constructor() {
        super();

        this.Vector = Vector;

        this.nowTime = Date.now();
        this.lastTime = this.nowTime;
    }

    _preOutUpdate() {
        this.lastTime = this.nowTime;
        this.nowTime = Date.now();
    }

    _postInUpdate() {
        this.lastTime = this.nowTime;
    }

    deltaTime() {
        return (this.nowTime - this.lastTime)/1000;
    }

    lerp(v1, v2, t) {
        return (v2 - v1) * t + v1
    }
}

export default Maths;