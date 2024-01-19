import MDog from "/MDogEngine/MDogMain.js"

const dt = 1 / MDog.ticksPerSecond;

const camera = new MDog.Math.Vector3(100, 100);

function gameTick() {

    if (MDog.Input.Keyboard.isDown("ArrowLeft")) {

    }
    if (MDog.Input.Keyboard.isDown("ArrowRight")) {

    }

    MDog.Draw.clear();
    MDog.Draw.rectangle(Math.floor(position.x), Math.floor(position.y), 10, 10, "#ff0000");
}

MDog.setActiveFunction(gameTick);
