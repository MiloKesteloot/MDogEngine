class Vector3 {
    x = 0;
    y = 0;
    z = 0;

    constructor(x, y, z) {
        if (x === undefined) {
            this.x = 0;
            this.y = 0;
            this.z = 0;
        } else if (y === undefined) {
            this.x = x;
            this.y = x;
            this.z = x;
        } else {
            this.x = x;
            this.y = y;
            this.z = z;
        }
    }

    toString() {
        return "(" + this.getX() + ", " + this.getY() + ", " + this.getZ() + ")";
    }

    getX() {
        return this.x;
    }

    getY() {
        return this.y;
    }

    getZ() {
        return this.z;
    }

    setX(x) {
        this.x = x;
        return this;
    }

    setY(y) {
        this.y = y;
        return this;
    }

    setZ(z) {
        this.z = z;
        return this;
    }

    set(x_or_vector3, y, z) {
        if (x_or_vector instanceof Vector3) {
            this.x = x_or_vector3.x;
            this.y = x_or_vector3.y;
            this.z = x_or_vector3.z;
        } else {
            this.x = x_or_vector3;
            this.y = y;
            this.z = z;
        }
        return this;
    }

    // Returns a new copy of this vector.
    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    // Add two values or a vector to this vector.
    add(x_or_vector3, y) {
        if (x_or_vector3 instanceof Vector3) {
            this.x += x_or_vector3.x;
            this.y += x_or_vector3.y;
            this.z += x_or_vector3.z;
        } else {
            this.x += x_or_vector3;
            this.y += y;
            this.z += z;
        }
        return this;
    }

    // Subtract two values or a vector from this vector.
    subtract(x_or_vector3, y, z) {
        if (x_or_vector3 instanceof Vector3) {
            this.x -= x_or_vector3.x;
            this.y -= x_or_vector3.y;
            this.z -= x_or_vector3.z;
        } else {
            this.x -= x_or_vector3;
            this.y -= y;
            this.z -= z;
        }
        return this;
    }

    // Get the length of this vector.
    length() {
        return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
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
            this.z /= length;
        }
        return this;
    }

    // Multiply this vector by a scalar.
    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }

    distanceTo(other) {
        return Math.sqrt(Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2) + Math.pow(this.z - other.z, 2));
    }

    // TODO is this correct?
    // dotProduct(other) {
    //     return this.x * other.x + this.y * other.y + this.z * other.z;
    // }
}

export default Vector3;