import MDog from "../../MDogModules/MDogMain.js"
import PixelFont from "./PixelFont.js";
import Panorama from "./Panorama.js";
import SplashText from "./SplashText.js";
import {loadImage, makeDirtBackground, makeButton} from "./textures.js";

// Textures copied from Minecraft (version 26.2). Relative to the page, like the engine's other assets.
const ASSET_FOLDER = "assets/minecraft-portfolio/";

// Title screen panoramas from different Minecraft versions, in assets/minecraft-portfolio/panoramas/<version>/.
// One is picked at random each time the page loads. Add "&panorama=1.20.6" to the URL to pick one.
// Press "i" on the page to see which one is showing, then the left and right arrow keys to flip through them.
const PANORAMAS = [
    {version: "1.13.2", name: "Update Aquatic"},
    {version: "1.16.5", name: "Nether Update"},
    {version: "1.17.1", name: "Caves & Cliffs part 1"},
    {version: "1.19.4", name: "The Wild Update"},
    {version: "1.20.6", name: "Trails & Tales, cherry blossoms"},
    {version: "26.1.2", name: "Cherry blossoms"},
];
const requestedPanorama = new URLSearchParams(window.location.search).get("panorama");
const requestedIndex = PANORAMAS.findIndex(panorama => panorama.version === requestedPanorama);
let panoramaIndex = requestedIndex !== -1 ? requestedIndex : Math.floor(Math.random() * PANORAMAS.length);

function loadPanoramaFaces(index) {
    return Promise.all([0, 1, 2, 3, 4, 5].map(i => loadImage(ASSET_FOLDER + "panoramas/" + PANORAMAS[index].version + "/panorama_" + i + ".png")));
}

const SPLASHES = [
    "Also play Hard to Convey!",
    "Shoutout Minecraft!",
];
const BOTTOM_LEFT_TEXT = "MDog Engine";
const BOTTOM_RIGHT_TEXT = "Milo Kesteloot " + new Date().getFullYear();

const Draw = MDog.Draw;
const Mouse = MDog.Input.Mouse;
const Keyboard = MDog.Input.Keyboard;

const screenWidth = Draw.getScreenWidthInArtPixels();
const screenHeight = Draw.getScreenHeightInArtPixels();

const [dirtImage, logoImage, buttonImage, buttonHighlightedImage, panoramaFaces] = await Promise.all([
    loadImage(ASSET_FOLDER + "dirt.png"),
    loadImage(ASSET_FOLDER + "logo.png"),
    loadImage(ASSET_FOLDER + "button.png"),
    loadImage(ASSET_FOLDER + "button_highlighted.png"),
    loadPanoramaFaces(panoramaIndex),
    PixelFont.load(ASSET_FOLDER + "ascii.png"),
]);

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
let panorama = null;
let dirtBackground = null;
try {
    panorama = new Panorama(panoramaFaces);
    document.body.prepend(panorama.element); // First on the page, so it's underneath
} catch (error) {
    console.warn("Using the dirt background instead of the panorama:", error);
    dirtBackground = makeDirtBackground(dirtImage, screenWidth, screenHeight, 2, 0.4);
}

// The logo image is high resolution, so like the splash it's an HTML element on top of the game instead of being
// squashed into the game's pixels. Placed like Minecraft's logo (256 game pixels wide, centered, 30 from the top), but LOGO_SCALE times bigger.
const LOGO_SCALE = 2;
const LOGO_WIDTH = 256 * LOGO_SCALE;
const LOGO_Y = 30;
const gameCanvas = Draw.mainDrawingBoard.element;
logoImage.style.position = "fixed";
logoImage.style.pointerEvents = "none";
document.body.appendChild(logoImage);
function positionLogo() {
    // Follows the game canvas, since it moves and changes size with the window
    const rect = gameCanvas.getBoundingClientRect();
    const gamePixelSize = rect.width / gameCanvas.width;
    logoImage.style.left = rect.left + (screenWidth - LOGO_WIDTH) / 2 * gamePixelSize + "px";
    logoImage.style.top = rect.top + LOGO_Y * gamePixelSize + "px";
    logoImage.style.width = LOGO_WIDTH * gamePixelSize + "px";
    requestAnimationFrame(positionLogo);
}
positionLogo();

// Where Minecraft puts its splash relative to its logo (123 right of center, 39 below the logo's top), scaled with the logo.
// Made after the logo so it's on top of it.
new SplashText(SPLASHES[Math.floor(Math.random() * SPLASHES.length)], gameCanvas, screenWidth / 2 + 123 * LOGO_SCALE, LOGO_Y + 39 * LOGO_SCALE);

// Debug text, shown by pressing "i", naming the panorama so unwanted ones can be found and removed from PANORAMAS
let showDebugText = false;
let debugText = null;
let latestPanoramaLoad = 0;

function makeDebugText(loading) {
    const panoramaInfo = PANORAMAS[panoramaIndex];
    let text = "Panorama " + (panoramaIndex + 1) + "/" + PANORAMAS.length + ": " + panoramaInfo.version;
    if (panoramaInfo.name) text += " " + panoramaInfo.name;
    if (loading) text += " (loading...)";
    debugText = PixelFont.render(text, "#ffffff");
}
makeDebugText(false);

// step is -1 for the previous panorama, 1 for the next
async function switchPanorama(step) {
    panoramaIndex = (panoramaIndex + step + PANORAMAS.length) % PANORAMAS.length;
    const thisLoad = ++latestPanoramaLoad;
    makeDebugText(true);
    try {
        const faces = await loadPanoramaFaces(panoramaIndex);
        if (thisLoad !== latestPanoramaLoad) return; // An arrow key was pressed again while this was loading
        panorama.setFaces(faces);
        makeDebugText(false);
    } catch (error) {
        console.error(error);
    }
}

const bottomLeftText = PixelFont.render(BOTTOM_LEFT_TEXT, "#ffffff");
const bottomRightText = PixelFont.render(BOTTOM_RIGHT_TEXT, "#ffffff");

function update() {
    if (Keyboard.isClicked("i")) {
        showDebugText = !showDebugText;
    }
    if (showDebugText && panorama) {
        if (Keyboard.isClicked("ArrowLeft")) switchPanorama(-1);
        if (Keyboard.isClicked("ArrowRight")) switchPanorama(1);
    }

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

    for (const button of buttons) {
        button.draw();
    }

    drawCanvas(bottomLeftText, 2, screenHeight - 10);
    drawCanvas(bottomRightText, screenWidth - bottomRightText.width - 1, screenHeight - 10);
    if (showDebugText) {
        drawCanvas(debugText, (screenWidth - debugText.width) / 2, screenHeight - 10);
    }
}

MDog.setActiveFunction(update);
