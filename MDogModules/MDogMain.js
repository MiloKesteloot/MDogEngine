import Module from "./MDogModule.js"; // TODO Why do I need this here for this to work?
import Draw from "./MDogDraw.js";
import Maths from "./MDogMaths.js";
import Input from "./MDogInput.js";
import UI from "./MDogUI.js";
import FX from "./MDogFX.js";
import AssetManager from "./MDogAssetManager.js";
import Basics from "./MDogBasics.js";
import ThreeDee from "./MDogThreeDee.js";

class MDog {
    constructor() {
        console.log("Created MDog instance.");

        // this.Units = new Units();
        this.Draw = new Draw(128*4, 384); // 384
        this.Input = new Input(this.Draw);
        this.Math = new Maths();
        this.UI = new UI(this.Draw, this.Input);
        this.FX = new FX();
        this.AssetManager = new AssetManager();
        this.Basics = new Basics(this);
        this.ThreeDee = new ThreeDee();

        this.activeFunction = null;

        this.ticksPerSecond = 160;
        this.unsimulatedTicks = 0;

        window.addEventListener("keydown", function(e) {
            if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
                e.preventDefault();
            }
        }, false);

        this._everyFrame();
    }

    _everyFrame() {

        this.Math._preOutUpdate();

        this.unsimulatedTicks += this.Math.deltaTime() * this.ticksPerSecond;

        if (this.unsimulatedTicks > 100) { this.unsimulatedTicks = 0; }


        while (this.unsimulatedTicks >= 1) {
            this.unsimulatedTicks -= 1;

            if (this.activeFunction != null) {
                this.activeFunction();
            }

            this.Input._postInUpdate();
        }

        // TODO should draw with browser refresh rate, not 160 times per second
        this.Draw._postOutUpdate();

        requestAnimationFrame(() => this._everyFrame());
    }

    setActiveFunction(activeFunction) {
        this.activeFunction = activeFunction;
    }
}

console.log("MDogMain.js script run")

export default new MDog();