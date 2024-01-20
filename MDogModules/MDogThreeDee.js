import Module from "./MDogModule.js";
import Vector from "./MDogMaths/Vector.js";
import Vector3 from "./MDogMaths/Vector3.js";
import Maths from "./MDogMaths.js";

class ThreeDee extends Module {
    constructor() {
        super();

        this.ThreeDeeScene = ThreeDeeScene;
        this.ThreeDeeRectangle = ThreeDeeRectangle;
    }
}

class ThreeDeeObject {

    constructor(scene) {
        this.scene = scene;
    }

    getScene() {
        return this.scene;
    }

    _draw() {}

}

class ThreeDeeRectangle extends ThreeDeeObject{

    constructor(scene, z, x1, y1, x2, y2, color) {
        super(scene);
        this.topLeft = new Vector3(x1, y1, z);
        this.bottomRight = new Vector3(x2, y2, z)
        this.color = color ?? "#ff0000";
    }

    _draw(Draw) {
        const topLeft = this.scene.threeDeeToTwoDeeVector3(this.topLeft);
        const bottomRight = this.scene.threeDeeToTwoDeeVector3(this.bottomRight);
        Draw.rectangle(
            topLeft.getX(),
            topLeft.getY(),
            bottomRight.getX(),
            bottomRight.getY(),
            this.color);
    }

}

class ThreeDeeScene {

    camera;

    objects;

    constructor(cameraX, cameraY, cameraZ) {
        this.camera = new Camera(cameraX, cameraY, cameraZ);
        this.objects = [];
    }

    threeDeeToTwoDee(vector3_or_x, y, z) {
        if (vector3_or_x instanceof Vector3) {
            return this.threeDeeToTwoDeeVector3(vector3_or_x);
        } else {
            return this.threeDeeToTwoDeeVector3(new Vector3(vector3_or_x, y, z));
        }
    }

    threeDeeToTwoDeeVector3(vector3) {
        let z = (vector3.z - this.camera.z);

        if (z === 0) {
            console.error("Divide by zero on TwoDeeToTreeDeeVector3.")
            console.log(vector3);
            console.log(this.camera);
            return;
        }

        let x = (vector3.x - this.camera.x) / z;
        let y = (vector3.y - this.camera.y) / z;

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

export default ThreeDee;