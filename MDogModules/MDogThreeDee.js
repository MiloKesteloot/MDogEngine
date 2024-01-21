import Module from "./MDogModule.js";
import Vector from "./MDogMaths/Vector.js";
import Vector3 from "./MDogMaths/Vector3.js";
import Maths from "./MDogMaths.js";

class ThreeDee extends Module {
    constructor() {
        super();

        this.ThreeDeeScene = ThreeDeeScene;
        this.Camera = Camera;
        this.ThreeDeeRectangle = ThreeDeeRectangle;
        this.ThreeDeeShape = ThreeDeeShape;
        this.ThreeDeeImage = ThreeDeeImage;
    }
}

class ThreeDeeScene {

    camera;

    objects;

    constructor(camera) {
        if (camera === undefined) {
            camera = new Camera(0, 0, 0, 10);
        }
        this.camera = camera;
        this.objects = [];
    }

    _draw(Draw) {
        for (let object of this.objects) {
            object._draw(Draw);
        }
    }

    addObject(object) {
        if (object.scene === undefined || object.scene === null) {
            object.scene = this;
        }
        this.objects.push(object);
    }

    threeDeeToTwoDee(Draw, vector3_or_x, y, z) {
        if (vector3_or_x instanceof Vector3) {
            return this.threeDeeToTwoDeeVector3(Draw, vector3_or_x);
        } else {
            return this.threeDeeToTwoDeeVector3(Draw, new Vector3(vector3_or_x, y, z));
        }
    }

    threeDeeToTwoDeeVector3(Draw, vector3) {
        let z = (vector3.z - this.camera.getZ());

        if (z === 0) {
            console.error("Divide by zero on TwoDeeToTreeDeeVector3.")
            console.log(vector3);
            console.log(this.camera);
            return;
        }

        let x = (vector3.x - this.camera.getX()) / z * this.camera.getFov();
        let y = (vector3.y - this.camera.getY()) / z * this.camera.getFov();

        const vec = new Vector(Math.floor(x), Math.floor(y));
        vec.add(Draw.getHalfScreenWidthInArtPixels(), Math.floor(Draw.getHalfScreenHeightInArtPixels()/2)); // TODO this /2 is totally scuffed
        // vec.y = Draw.getScreenHeightInArtPixels() - vec.y;
        return vec;
    }

    getCamera() {
        return this.camera;
    }
}

class Camera {

    position;
    fov;
    // TODO add angle

    constructor(x, y, z, fov) {
        this.position = new Vector3(x, y, z);
        this.fov = fov;
    }

    getX() {
        return this.position.x;
    }

    getY() {
        return this.position.y;
    }

    getZ() {
        return this.position.z;
    }

    getFov() {
        return this.fov;
    }

}

class ThreeDeeObject {

    constructor() {
        this.scene = null;
    }

    getScene() {
        return this.scene;
    }

    _draw() {}

}

class ThreeDeeImage extends ThreeDeeObject {
    constructor(x, y, z, path, width, height, settings) {
        settings = settings ?? {};
        super();
        this.path = path;
        this.width = width;
        this.height = height;
        this.bottomMiddle = new Vector3(x, y, z);
    }

    _draw(Draw) {
        const pos = this.scene.threeDeeToTwoDeeVector3(Draw, this.bottomMiddle);
        pos.subtract(Math.floor(this.width/2), 0); //this.height
        Draw.image(this.path, pos.x, pos.y, {width: this.width, height: this.height});
    }
}

class ThreeDeeRectangle extends ThreeDeeObject {

    // Settings: color, stroke
    constructor(z, x1, y1, x2, y2, color, settings) {
        settings = settings ?? {};
        super();
        this.topLeft = new Vector3(x1, y1, z);
        this.bottomRight = new Vector3(x2, y2, z)
        this.color = color;
        this.stroke = settings.stroke ?? "#00000000";
    }

    _draw(Draw) {
        const topLeft = this.scene.threeDeeToTwoDeeVector3(Draw, this.topLeft);
        const bottomRight = this.scene.threeDeeToTwoDeeVector3(Draw, this.bottomRight);
        bottomRight.x -= topLeft.x;
        bottomRight.y -= topLeft.y;

        Draw.rectangleFill(
            topLeft.getX(),
            topLeft.getY(),
            bottomRight.getX() + 1,
            bottomRight.getY() + 1, // TODO the +1 is totally arbitrary to get it to line up with the shape
            this.color);
        Draw.rectangle(
            topLeft.getX(),
            topLeft.getY(),
            bottomRight.getX() + 1,
            bottomRight.getY() + 1, // TODO same here
            this.stroke);
    }

}

class ThreeDeeShape extends ThreeDeeObject {

    // Settings: color, stroke
    constructor(points, color, settings) {
        settings = settings ?? {};
        super();
        this.points = points
        this.color = color;
        this.stroke = settings.stroke ?? "transparent";
    }

    _draw(Draw) {

        const newPoints = [];

        for (let point of this.points) {
            newPoints.push(this.scene.threeDeeToTwoDeeVector3(Draw, point));
        }

        if (this.color !== "transparent") {
            Draw.polygonFill(newPoints, this.color);
        }
        if (this.stroke !== "transparent") {
            Draw.polygon(newPoints, this.stroke);
        }
    }

}

export default ThreeDee;