import MDog from "/MDogEngine/MDogModules/MDogMain.js"

const Vector = MDog.Math.Vector;
const Vector3 = MDog.Math.Vector3;

const TD = MDog.ThreeDee;

const threeDeeScene = new TD.ThreeDeeScene(new TD.Camera(0, -14, 0, 100));

const wallZ = 10;

function makeFloor() {

    const plankCount = 9;

    const plankLength = 4;
    const plankWidth = 0.3;

    const plankColor = "transparent"; //#C5CCB8
    const crackColor = "#BE955C";
    const floorColor = "#C5CCB8";

    threeDeeScene.addObject(new TD.ThreeDeeFloor(0, wallZ, wallZ - plankCount * plankWidth));

    for (let j = 0; j < plankCount + 1; j++) {
        const move = (plankLength / 2) * (j % 2);

        threeDeeScene.addObject(new TD.ThreeDeeShape([
                new Vector3(-19, 0, wallZ - j * plankWidth),
                new Vector3(-19 + 9.5 * plankLength, 0, wallZ - j * plankWidth),
            ],
            plankColor, {stroke: crackColor}));

        if (j !== plankCount) {
            for (let i = 0; i < 10; i++) {
                threeDeeScene.addObject(new TD.ThreeDeeShape([
                        new Vector3(-19 + i * plankLength + move, 0, wallZ - j * plankWidth),
                        new Vector3(-19 + i * plankLength + move, 0, wallZ - plankWidth - j * plankWidth),
                        // new Vector3(-21 + (i + 1) * plankLength + move, 0, 8 + plankWidth + j * plankWidth),
                        // new Vector3(-21 + (i + 1) * plankLength + move, 0, 8 + j * plankWidth),
                    ],
                    plankColor, {stroke: crackColor}));
            }
        }
    }
}

function makeLocker() {

    const lockerLeftX = -3.5;
    const lockerHeight = 3;
    const lockerDepth = 0.5;
    const lockerWidth = 7;

    threeDeeScene.addObject(new TD.ThreeDeeShape([
            new Vector3(lockerLeftX, -lockerHeight, wallZ - lockerDepth),
            new Vector3(lockerLeftX, 0, wallZ - lockerDepth),
            new Vector3(lockerLeftX, 0, wallZ),
            new Vector3(lockerLeftX, -lockerHeight, wallZ),
        ],
        "red", {stroke: "blue"}));
    threeDeeScene.addObject(new TD.ThreeDeeShape([
            new Vector3(lockerLeftX + lockerWidth, -lockerHeight, wallZ - lockerDepth),
            new Vector3(lockerLeftX + lockerWidth, 0, wallZ - lockerDepth),
            new Vector3(lockerLeftX + lockerWidth, 0, wallZ),
            new Vector3(lockerLeftX + lockerWidth, -lockerHeight, wallZ),
        ],
        "red", {stroke: "blue"}));
    threeDeeScene.addObject(new TD.ThreeDeeRectangle(
        wallZ - lockerDepth,
        lockerLeftX,
        -lockerHeight,
        lockerLeftX + lockerWidth,
        0,
        "red", {stroke: "blue"}));
    // threeDeeScene.addObject(new TD.ThreeDeeImage(0, -10, 10, "side/city/Buildings.png", 100, 100));
}

makeFloor();
makeLocker();

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
    // MDog.Draw.rectangleFill(0, 238, MDog.Draw.getScreenWidthInArtPixels(), 34, "#C5CCB8");

    MDog.Draw.threeDeeScene(threeDeeScene);

    MDog.Draw.image("side/girl/idle/Warrior_Idle_1.png", MDog.Draw.getHalfScreenWidthInArtPixels(), 210);
}

MDog.Draw.setBackgroundColor("#222");

MDog.setActiveFunction(gameTick);