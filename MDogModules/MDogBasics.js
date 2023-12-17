import Module from "./MDogModule.js";
// import Player from "../games/side/Player/Player.js";
import SquareHitbox from "./MDogBasics/Hitbox/SquareHitbox.js";

class Basics extends Module {
    constructor(MDogInput) {
        super();

        // this.Player = Player;
        this.SquareHitbox = SquareHitbox;
    }
}

export default Basics;