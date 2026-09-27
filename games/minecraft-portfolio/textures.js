import PixelFont from "./PixelFont.js";

// Builds the menu's images from Minecraft's textures (in assets/minecraft-portfolio/).
// Everything is drawn once into a canvas at startup, so the menu only has to copy finished images each tick.

export function makeCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").imageSmoothingEnabled = false;
    return canvas;
}

export function loadImage(path) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Failed to load image " + path));
        image.src = path;
    });
}

// Tiled dirt blocks, darkened like Minecraft's menu backgrounds. brightness is 0 to 1.
export function makeDirtBackground(dirtImage, width, height, tileScale, brightness) {
    const tileSize = dirtImage.width * tileScale;

    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext("2d");
    for (let y = 0; y < height; y += tileSize) {
        for (let x = 0; x < width; x += tileSize) {
            ctx.drawImage(dirtImage, x, y, tileSize, tileSize);
        }
    }
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - brightness})`;
    ctx.fillRect(0, 0, width, height);
    return canvas;
}

// Repeats part of an image to fill an area, cutting off the last copy if it doesn't fit
function tileRegion(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh) {
    for (let y = 0; y < dh; y += sh) {
        for (let x = 0; x < dw; x += sw) {
            const w = Math.min(sw, dw - x);
            const h = Math.min(sh, dh - y);
            ctx.drawImage(image, sx, sy, w, h, dx + x, dy + y, w, h);
        }
    }
}

// Minecraft's "nine slice" scaling: corners stay the same, edges and middle repeat to fill the new size
function drawNineSlice(ctx, image, border, width, height) {
    const b = border;
    const innerSourceWidth = image.width - b * 2;
    const innerSourceHeight = image.height - b * 2;
    const innerWidth = width - b * 2;
    const innerHeight = height - b * 2;

    // Corners
    ctx.drawImage(image, 0, 0, b, b, 0, 0, b, b);
    ctx.drawImage(image, image.width - b, 0, b, b, width - b, 0, b, b);
    ctx.drawImage(image, 0, image.height - b, b, b, 0, height - b, b, b);
    ctx.drawImage(image, image.width - b, image.height - b, b, b, width - b, height - b, b, b);

    // Edges
    tileRegion(ctx, image, b, 0, innerSourceWidth, b, b, 0, innerWidth, b);
    tileRegion(ctx, image, b, image.height - b, innerSourceWidth, b, b, height - b, innerWidth, b);
    tileRegion(ctx, image, 0, b, b, innerSourceHeight, 0, b, b, innerHeight);
    tileRegion(ctx, image, image.width - b, b, b, innerSourceHeight, width - b, b, b, innerHeight);

    // Middle
    tileRegion(ctx, image, b, b, innerSourceWidth, innerSourceHeight, b, b, innerWidth, innerHeight);
}

// sprite is one of Minecraft's button textures (button.png, button_highlighted.png, button_disabled.png)
export function makeButton(label, width, height, sprite, textColor) {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext("2d");

    drawNineSlice(ctx, sprite, 3, width, height); // Border of 3 is from the sprite's .mcmeta file

    const text = PixelFont.render(label, textColor);
    const textX = Math.floor((width - PixelFont.measure(label)) / 2);
    const textY = Math.floor((height - PixelFont.height) / 2);
    ctx.drawImage(text, textX, textY);

    return canvas;
}
