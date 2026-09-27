import MDog from "../../MDogModules/MDogMain.js"
import PixelFont from "./PixelFont.js";
import Panorama from "./Panorama.js";
import SplashText from "./SplashText.js";
import {loadImage, makeDirtBackground, makeButton, makeLogo} from "./textures.js";

// Textures copied from Minecraft (version 26.2). Relative to the page, like the engine's other assets.
const ASSET_FOLDER = "assets/minecraft-portfolio/";

// Title screen panoramas from different Minecraft versions, in assets/minecraft-portfolio/panoramas/<version>/.
// One is picked at random each time the page loads. Add "&panorama=1.20.6" to the URL to pick one.
const PANORAMAS = [
    "1.12.2",  // The classic one
    "1.13.2",  // Update Aquatic
    "1.14.4",  // Village & Pillage
    "1.15.2",  // Buzzy Bees
    "1.16.5",  // Nether Update
    "1.17.1",  // Caves & Cliffs part 1
    "1.18.2",  // Caves & Cliffs part 2
    "1.19.4",  // The Wild Update
    "1.20.6",  // Trails & Tales, cherry blossoms
    "1.21.3",  // Tricky Trials
    "1.21.4",  // The Garden Awakens
    "1.21.5",  // Spring to Life
    "1.21.8",  // Chase the Skies
    "1.21.10", // The Copper Age
    "1.21.11",
    "26.1.2",  // Cherry blossoms
    "26.2",
    "26.3",
];
const requestedPanorama = new URLSearchParams(window.location.search).get("panorama");
const panoramaVersion = PANORAMAS.includes(requestedPanorama) ? requestedPanorama : PANORAMAS[Math.floor(Math.random() * PANORAMAS.length)];

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

const Draw = MDog.Draw;
const Mouse = MDog.Input.Mouse;

const screenWidth = Draw.getScreenWidthInArtPixels();
const screenHeight = Draw.getScreenHeightInArtPixels();

const [dirtImage, stoneImage, buttonImage, buttonHighlightedImage, ...panoramaFaces] = await Promise.all([
    loadImage(ASSET_FOLDER + "dirt.png"),
    loadImage(ASSET_FOLDER + "stone.png"),
    loadImage(ASSET_FOLDER + "button.png"),
    loadImage(ASSET_FOLDER + "button_highlighted.png"),
    ...[0, 1, 2, 3, 4, 5].map(i => loadImage(ASSET_FOLDER + "panoramas/" + panoramaVersion + "/panorama_" + i + ".png")),
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

// The spinning panorama fills the window behind the game's canvas, which is see-through where nothing is drawn.
// If the browser can't do WebGL, the game draws tiled dirt instead.
let dirtBackground = null;
try {
    const panorama = new Panorama(panoramaFaces);
    document.body.prepend(panorama.element); // First on the page, so it's underneath
} catch (error) {
    console.warn("Using the dirt background instead of the panorama:", error);
    dirtBackground = makeDirtBackground(dirtImage, screenWidth, screenHeight, 2, 0.4);
}

const logo = makeLogo(TITLE, 4, 4, stoneImage);
const logoX = Math.floor((screenWidth - logo.width) / 2);
const logoY = 30;

// Minecraft puts the splash 5 pixels in from the logo's right edge and 5 pixels up from its bottom
new SplashText(SPLASHES[Math.floor(Math.random() * SPLASHES.length)], Draw.mainDrawingBoard.element, logoX + logo.width - 5, logoY + logo.height - 5);

const bottomLeftText = PixelFont.render(BOTTOM_LEFT_TEXT, "#ffffff");
const bottomRightText = PixelFont.render(BOTTOM_RIGHT_TEXT, "#ffffff");

function update() {
    let anyHovered = false;
    for (const button of buttons) {
        button.update();
        anyHovered = anyHovered || button.hovered;
    }
    Mouse.requestStyle(anyHovered ? "pointer" : "default");

    if (dirtBackground) {
        drawCanvas(dirtBackground, 0, 0);
    } else {
        Draw.clear({color: "transparent"});
    }
    drawCanvas(logo, logoX, logoY);

    for (const button of buttons) {
        button.draw();
    }

    drawCanvas(bottomLeftText, 2, screenHeight - 10);
    drawCanvas(bottomRightText, screenWidth - bottomRightText.width - 1, screenHeight - 10);
}

MDog.setActiveFunction(update);
