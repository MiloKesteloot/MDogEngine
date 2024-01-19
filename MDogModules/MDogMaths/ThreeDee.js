import Vector3 from "./Vector3.js";

class ThreeDee {

    camera;

    constructor(cameraX, cameraY, cameraZ) {
        this.camera = new Camera(cameraX, cameraY, cameraZ);
    }

    TwoDeeToThreeDee(vector3) {
        const vector3Clone = vector3.clone();
        let x = vector3Clone.x / vector3Clone.z;
    }
}

class Camera {

    position;
    // TODO add angle

    constructor(x, y, z) {
        this.position = new Vector3(x, y, z);
    }

}