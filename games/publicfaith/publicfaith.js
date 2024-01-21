import MDog from "/MDogEngine/MDogModules/MDogMain.js"

const Vector = MDog.Math.Vector;
const Vector3 = MDog.Math.Vector3;

const TD = MDog.ThreeDee;

const threeDeeScene = new TD.ThreeDeeScene(new TD.Camera(0, -14, 0, 100));

const plankLength = 4;
const plankWidth = 0.3;

const plankColor = "transparent"; //#C5CCB8
const crackColor = "#BE955C";

for (let j = 0; j < 7; j++) {
    const move = (plankLength / 2) * (j % 2);

    threeDeeScene.addObject(new TD.ThreeDeeShape([
        new Vector3(-19, 0, 8 + j * plankWidth),
        new Vector3(-19 + 9.5 * plankLength, 0, 8 + j * plankWidth),
    ],
        plankColor, {stroke: crackColor}));

    if (j !== 6) {
        for (let i = 0; i < 10; i++) {
            threeDeeScene.addObject(new TD.ThreeDeeShape([
                    new Vector3(-19 + i * plankLength + move, 0, 8 + j * plankWidth),
                    new Vector3(-19 + i * plankLength + move, 0, 8 + plankWidth + j * plankWidth),
                    // new Vector3(-21 + (i + 1) * plankLength + move, 0, 8 + plankWidth + j * plankWidth),
                    // new Vector3(-21 + (i + 1) * plankLength + move, 0, 8 + j * plankWidth),
                ],
                plankColor, {stroke: crackColor}));
        }
    }
}

threeDeeScene.addObject(new TD.ThreeDeeShape([
    new Vector3(-10, -10, 10),
    new Vector3(-10, 0, 10),
    new Vector3(-10, 0, 11),
    new Vector3(-10, -10, 11),
],
    "red", {stroke: "blue"}));
threeDeeScene.addObject(new TD.ThreeDeeShape([
        new Vector3(10, -10, 10),
        new Vector3(10, 0, 10),
        new Vector3(10, 0, 11),
        new Vector3(10, -10, 11),
    ],
    "red", {stroke: "blue"}));
threeDeeScene.addObject(new TD.ThreeDeeRectangle(10, -10, -10, 10, 0, "red", {stroke: "blue"}));
threeDeeScene.addObject(new TD.ThreeDeeImage(0, -10, 10, "side/city/Buildings.png", 32, 16));


// threeDeeScene.addObject(new TD.ThreeDeeRectangle(10, -10, -10, 10, 10));
const camera = threeDeeScene.getCamera();
function gameTick() {

    if (MDog.Input.Keyboard.isDown("ArrowLeft")) {
        camera.position.x -= 0.1;
    }
    if (MDog.Input.Keyboard.isDown("ArrowRight")) {
        camera.position.x += 0.1;
    }
    // if (MDog.Input.Keyboard.isDown("ArrowDown")) {
    //     camera.position.z -= 0.1;
    // }
    // if (MDog.Input.Keyboard.isDown("ArrowUp")) {
    //     camera.position.z += 0.1;
    // }

    MDog.Draw.clear();
    MDog.Draw.rectangleFill(0, 238, MDog.Draw.getScreenWidthInArtPixels(), 34, "#C5CCB8");

    MDog.Draw.threeDeeScene(threeDeeScene);
}

MDog.Draw.setBackgroundColor("#222");

MDog.setActiveFunction(gameTick);