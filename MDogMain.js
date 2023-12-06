import Module from "/MDogEngine/MDogModule.js"; // TODO Why do I need this here for this to work?
import Draw from "/MDogEngine/MDogDraw.js";
import Maths from "/MDogEngine/MDogMaths.js";
import Input from "/MDogEngine/MDogInput.js";
import UI from "/MDogEngine/MDogUI.js";
import FX from "/MDogEngine/MDogFX.js";
import AssetManager from "/MDogEngine/MDogAssetManager.js";

class MDog {
    constructor() {
        console.log("Created MDog instance.");

        // this.Units = new Units();
        this.Draw = new Draw(128*4, 384); // 384
        this.Input = new Input(this.Draw);
        this.Math = new Maths();
        this.UI = new UI(this.Draw);
        this.FX = new FX();
        this.AssetManager = new AssetManager();

        this.activeFunction = null;

        this.ticksPerSecond = 160;
        this.unsimulatedTicks = 0;

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

        this.Draw._postOutUpdate();

        requestAnimationFrame(() => this._everyFrame());
    }

    setActiveFunction(activeFunction) {
        this.activeFunction = activeFunction;
    }
}

console.log("MDogMain.js script run")

export default new MDog();