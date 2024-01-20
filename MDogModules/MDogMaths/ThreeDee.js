import Vector from "./Vector.js";
import Vector3 from "./Vector3.js";

class ThreeDee {

    camera;

    constructor(cameraX, cameraY, cameraZ) {
        this.camera = new Camera(cameraX, cameraY, cameraZ);
    }

    TwoDeeToThreeDee(vector3) {
        let x = (vector3.x ) / vector3.z;
        let y = vector3.y / vector3.z;

        return new Vector(Math.floor(x), Math.floor(y));
    }
}

class Camera {

    position;
    // TODO add angle

    constructor(x, y, z) {
        this.position = new Vector3(x, y, z);
    }

}