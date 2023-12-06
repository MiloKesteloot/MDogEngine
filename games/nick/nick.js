import MDog from "/MDogEngine/MDogMain.js"

const dt = 1 / MDog.ticksPerSecond;

const position = new MDog.Math.Vector(100, 100);
const velocity = new MDog.Math.Vector(0, 0);
const acceleration = new MDog.Math.Vector(0, 0);

const groundAcc = 50;
const maxGroundVel = 100;

function gameTick() {

    acceleration.multiply(0);

    if (MDog.Input.Keyboard.isDown("ArrowLeft")) {
        acceleration.x -= groundAcc;
    }
    if (MDog.Input.Keyboard.isDown("ArrowRight")) {
        acceleration.x += groundAcc;
    }
    if (MDog.Input.Keyboard.isDown("ArrowUp")) {
        acceleration.y -= groundAcc;
    }
    if (MDog.Input.Keyboard.isDown("ArrowDown")) {
        acceleration.y += groundAcc;
    }

    velocity.add(acceleration.clone().multiply(dt));

    velocity.constrain(maxGroundVel);

    position.add(velocity.clone().multiply(dt));

    MDog.Draw.clear();
    MDog.Draw.rectangle(Math.floor(position.x), Math.floor(position.y), 10, 10, "#ff0000");

    console.log(velocity)
}

MDog.setActiveFunction(gameTick);
