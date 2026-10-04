import PixelFont from "./PixelFont.js";

// Minecraft's yellow splash text, as its own HTML element on top of the game's canvas.
// The text is drawn once at 1x, then the browser rotates and scales it at full screen resolution with sharp pixels,
// the same way Minecraft draws it, instead of squashing it into the low resolution game canvas.
class SplashText {
    // anchorX, anchorY - where the bottom middle of the text goes, in game pixels
    // Settings - size (multiplies Minecraft's size, default 1)
    constructor(text, gameCanvas, anchorX, anchorY, settings) {
        settings = settings ?? {};
        this.size = settings.size ?? 1;
        this.gameCanvas = gameCanvas;
        this.anchorX = anchorX;
        this.anchorY = anchorY;
        this.textWidth = PixelFont.measure(text);

        this.element = PixelFont.render(text, "#ffff00");
        this.element.style.position = "fixed";
        this.element.style.left = "0";
        this.element.style.top = "0";
        this.element.style.transformOrigin = "0 0";
        this.element.style.imageRendering = "pixelated";
        this.element.style.pointerEvents = "none"; // So it doesn't block the mouse from the game
        document.body.appendChild(this.element); // Last on the page, so it's on top of the game

        const onFrame = () => {
            this._update();
            requestAnimationFrame(onFrame);
        };
        requestAnimationFrame(onFrame);
    }

    _update() {
        // Follow the game canvas, since it moves and changes size with the window
        const rect = this.gameCanvas.getBoundingClientRect();
        const gamePixelSize = rect.width / this.gameCanvas.width;
        const x = rect.left + this.anchorX * gamePixelSize;
        const y = rect.top + this.anchorY * gamePixelSize;

        // Same as Minecraft's SplashRenderer: pulses twice a second, and longer text is drawn smaller
        let scale = 1.8 - Math.abs(Math.sin((performance.now() % 1000) / 1000 * Math.PI * 2) * 0.1);
        scale = scale * 100 / (this.textWidth + 32) * this.size;

        // Read right to left: center the text above the anchor, scale it, tilt it, then move it into place
        this.element.style.transform =
            `translate(${x}px, ${y}px) rotate(-20deg) scale(${scale * gamePixelSize}) translate(${-this.textWidth / 2}px, -8px)`;
    }
}

export default SplashText;
