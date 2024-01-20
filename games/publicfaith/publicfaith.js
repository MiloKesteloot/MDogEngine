import MDog from "/MDogEngine/MDogModules/MDogMain.js"

const threeDeeScene = new MDog.ThreeDee.ThreeDeeScene();

function gameTick() {

    if (MDog.Input.Keyboard.isDown("ArrowLeft")) {

    }
    if (MDog.Input.Keyboard.isDown("ArrowRight")) {

    }

    MDog.Draw.clear();
}

MDog.Draw.setBackgroundColor("#222");

MDog.setActiveFunction(gameTick);