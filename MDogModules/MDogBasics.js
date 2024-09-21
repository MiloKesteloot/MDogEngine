import Module from "./MDogModule.js";
// import Player from "../games/side/Player/Player.js";
import SquareKickbox from "./MDogBasics/Kickbox/SquareKickbox.js";

class Basics extends Module {
    constructor(MDogInput) {
        super();

        // this.Player = Player;
        this.SquareKickbox = SquareKickbox;
    }
}

export default Basics;