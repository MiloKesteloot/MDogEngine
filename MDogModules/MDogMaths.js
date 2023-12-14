import Module from "/MDogModules/MDogModule.js";
import Vector from "/MDogModules/MDogMaths/Vector.js";

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