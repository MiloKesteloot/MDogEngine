import MDog from "../../MDogModules/MDogMain.js"
import PixelFont from "./PixelFont.js";
import Panorama from "./Panorama.js";
import {loadImage, makeDirtBackground, makeButton, makeLogo, makeSplash} from "./textures.js";

// Textures copied from Minecraft (version 26.2). Relative to the page, like the engine's other assets.
const ASSET_FOLDER = "assets/minecraft-portfolio/";

const TITLE = "MILO KESTELOOT";
const SPLASHES = [
    "Now with more portfolio!",
    "Made with MDog Engine!",
    "100% hand placed pixels!",
    "Also try the other games!",
    "Now in pixelated 2D!",
];
const BOTTOM_LEFT_TEXT = "MDog Engine";
const BOTTOM_RIGHT_TEXT = "Milo Kesteloot " + new Date().getFullYear();
const PANORAMA_DEGREES_PER_SECOND = 2; // Minecraft's speed, about 3 minutes per full turn

const Draw = MDog.Draw;
const Mouse = MDog.Input.Mouse;

const screenWidth = Draw.getScreenWidthInArtPixels();
const screenHeight = Draw.getScreenHeightInArtPixels();

const [dirtImage, stoneImage, buttonImage, buttonHighlightedImage, ...panoramaFaces] = await Promise.all([
    loadImage(ASSET_FOLDER + "dirt.png"),
    loadImage(ASSET_FOLDER + "stone.png"),
    loadImage(ASSET_FOLDER + "button.png"),
    loadImage(ASSET_FOLDER + "button_highlighted.png"),
    ...[0, 1, 2, 3, 4, 5].map(i => loadImage(ASSET_FOLDER + "panorama_" + i + ".png")),
    PixelFont.load(ASSET_FOLDER + "ascii.png"), // Last, so it doesn't end up in panoramaFaces
]);
panoramaFaces.pop(); // PixelFont.load's result

// Draws a canvas made in textures.js. Draw.image() only loads files from assets/, so this uses the engine's raw image drawer.
function drawCanvas(canvas, x, y, scale) {
    Draw._rawImage(canvas, Math.floor(x), Math.floor(y), canvas.width, canvas.height, {scale: scale ?? 1});
}

class MenuButton {
    constructor(label, x, y, width, onClick) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = 20;
        this.onClick = onClick;
        this.hovered = false;

        this.normalImage = makeButton(label, this.width, this.height, buttonImage, "#ffffff");
        this.hoverImage = makeButton(label, this.width, this.height, buttonHighlightedImage, "#ffffff");
    }

    update() {
        const x = Mouse.getX();
        const y = Mouse.getY();
        this.hovered = Mouse.getOnScreen() && x >= this.x && x < this.x + this.width && y >= this.y && y < this.y + this.height;

        if (this.hovered && Mouse.getClick(0)) {
            this.onClick();
        }
    }

    draw() {
        drawCanvas(this.hovered ? this.hoverImage : this.normalImage, this.x, this.y);
    }
}

// Same layout as Minecraft's title screen
const buttonX = screenWidth / 2 - 100;
const buttonY = screenHeight / 4 + 48;
const buttons = [
    new MenuButton("Singleplayer", buttonX, buttonY, 200, () => console.log("Singleplayer clicked")),
    new MenuButton("Multiplayer", buttonX, buttonY + 24, 200, () => console.log("Multiplayer clicked")),
    new MenuButton("Minecraft Realms", buttonX, buttonY + 48, 200, () => console.log("Minecraft Realms clicked")),
];

// The spinning panorama, or tiled dirt if the browser can't do WebGL
let panorama = null;
let dirtBackground = null;
try {
    panorama = new Panorama(screenWidth, screenHeight, panoramaFaces);
} catch (error) {
    console.warn("Using the dirt background instead of the panorama:", error);
    dirtBackground = makeDirtBackground(dirtImage, screenWidth, screenHeight, 2, 0.4);
}

const logo = makeLogo(TITLE, 4, 4, stoneImage);
const logoX = Math.floor((screenWidth - logo.width) / 2);
const logoY = 30;

const splash = makeSplash(SPLASHES[Math.floor(Math.random() * SPLASHES.length)], "#ffff00", -20, 160);
const splashCenterX = logoX + logo.width - 16;
const splashCenterY = logoY + logo.height + 8;

const bottomLeftText = PixelFont.render(BOTTOM_LEFT_TEXT, "#ffffff");
const bottomRightText = PixelFont.render(BOTTOM_RIGHT_TEXT, "#ffffff");

function update() {
    let anyHovered = false;
    for (const button of buttons) {
        button.update();
        anyHovered = anyHovered || button.hovered;
    }
    Mouse.requestStyle(anyHovered ? "pointer" : "default");

    if (panorama) {
        panorama.render(performance.now() / 1000 * PANORAMA_DEGREES_PER_SECOND);
        drawCanvas(panorama.image, 0, 0);
    } else {
        drawCanvas(dirtBackground, 0, 0);
    }
    drawCanvas(logo, logoX, logoY);

    // Pulses twice a second, like Minecraft's splash text
    const pulse = 1 - Math.abs(Math.sin(performance.now() / 1000 * Math.PI * 2)) * 0.06;
    const splashSize = splash.width * pulse;
    drawCanvas(splash, splashCenterX - splashSize / 2, splashCenterY - splashSize / 2, pulse);

    for (const button of buttons) {
        button.draw();
    }

    drawCanvas(bottomLeftText, 2, screenHeight - 10);
    drawCanvas(bottomRightText, screenWidth - bottomRightText.width - 1, screenHeight - 10);
}

MDog.setActiveFunction(update);
