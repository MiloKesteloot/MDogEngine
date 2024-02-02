import MDog from "/MDogEngine/MDogModules/MDogMain.js"
const Vector = MDog.Math.Vector;
const Draw = MDog.Draw;
const Mouse = MDog.Input.Mouse;

const anch = new Vector(100, 200);
const mouse = new Vector(0, 0);
const armLength = 50;
const extendLimit = 0.95;

function gameTick() {

    mouse.x = Mouse.getX();
    mouse.y = Mouse.getY();

    const anchToMouse = mouse.clone().subtract(anch);
    anchToMouse.multiply(0.5);
    const halfAnchToMouse = anchToMouse.clone().multiply(0.5);

    halfAnchToMouse.constrain(armLength*extendLimit);

    const x = armLength;
    const y = halfAnchToMouse.length();
    let inSqrt = x*x - y*y;
    if (inSqrt < 0) {
        inSqrt = 0;
    }
    const z = Math.sqrt(inSqrt);

    const rotVec = anchToMouse.clone()
    rotVec.rotate(-90);
    rotVec.setLength(z);

    const finalVec = anch.clone().add(halfAnchToMouse).add(rotVec);

    Draw.clear();
    // Draw.line(anch.x, anch.y, mouse.x, mouse.y, "#aa0000");
    Draw.line(anch.x, anch.y, finalVec.x, finalVec.y, "#ff0000");

    const closedMouse = anch.clone().add(anchToMouse.constrain(x*extendLimit*2));

    Draw.line(finalVec.x, finalVec.y, closedMouse.x, closedMouse.y, "#00ffff");

}

MDog.Draw.setBackgroundColor("#222");
MDog.setActiveFunction(gameTick);