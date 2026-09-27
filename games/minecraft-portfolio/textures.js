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

function rgb(color, brightnessShift) {
    const shift = brightnessShift ?? 0;
    const r = Math.max(0, Math.min(255, Math.round(color[0] + shift)));
    const g = Math.max(0, Math.min(255, Math.round(color[1] + shift)));
    const b = Math.max(0, Math.min(255, Math.round(color[2] + shift)));
    return `rgb(${r}, ${g}, ${b})`;
}

function getPixels(image) {
    const ctx = makeCanvas(image.width, image.height).getContext("2d");
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, image.width, image.height).data;
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

// Big blocky letters with a stone face, a 3D side, and a black outline, in the style of the Minecraft logo.
// blockSize is how many pixels each font pixel becomes, depth is how far the 3D side sticks out.
export function makeLogo(text, blockSize, depth, stoneImage) {
    const mask = PixelFont.render(text, "#ffffff", {shadow: false});
    const maskData = mask.getContext("2d").getImageData(0, 0, mask.width, mask.height).data;
    const isOn = (x, y) => x >= 0 && y >= 0 && x < mask.width && y < mask.height && maskData[(y * mask.width + x) * 4 + 3] > 0;

    const stone = getPixels(stoneImage);
    const stoneShade = (x, y) => stone[((y % stoneImage.height) * stoneImage.width + (x % stoneImage.width)) * 4];

    // Skip empty descender rows so the logo is not padded at the bottom
    let rowCount = 0;
    for (let y = 0; y < mask.height; y++) {
        for (let x = 0; x < mask.width; x++) {
            if (isOn(x, y)) rowCount = y + 1;
        }
    }

    const padding = 1; // Room for the outline
    const canvas = makeCanvas(mask.width * blockSize + depth + padding * 2, rowCount * blockSize + depth + padding * 2);
    const ctx = canvas.getContext("2d");

    // 3D side: stacked copies moving down and right, darker the further back they are
    for (let d = depth; d >= 1; d--) {
        const shade = 40 + Math.round(40 * (1 - d / depth));
        ctx.fillStyle = rgb([shade, shade, shade]);
        for (let y = 0; y < rowCount; y++) {
            for (let x = 0; x < mask.width; x++) {
                if (isOn(x, y)) {
                    ctx.fillRect(padding + x * blockSize + d, padding + y * blockSize + d, blockSize, blockSize);
                }
            }
        }
    }

    // Front face: stone texture, with lighter top/left edges and darker bottom/right edges
    for (let y = 0; y < rowCount; y++) {
        for (let x = 0; x < mask.width; x++) {
            if (!isOn(x, y)) continue;
            for (let j = 0; j < blockSize; j++) {
                for (let i = 0; i < blockSize; i++) {
                    const pixelX = x * blockSize + i;
                    const pixelY = y * blockSize + j;
                    let shift = 20;
                    if (j === 0 && !isOn(x, y - 1)) shift = 80;
                    else if (i === 0 && !isOn(x - 1, y)) shift = 55;
                    else if (j === blockSize - 1 && !isOn(x, y + 1)) shift = -20;
                    else if (i === blockSize - 1 && !isOn(x + 1, y)) shift = -10;
                    const shade = stoneShade(pixelX, pixelY);
                    ctx.fillStyle = rgb([shade, shade, shade], shift);
                    ctx.fillRect(padding + pixelX, padding + pixelY, 1, 1);
                }
            }
        }
    }

    // Black outline around everything
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const isFilled = (x, y) => x >= 0 && y >= 0 && x < canvas.width && y < canvas.height && data[(y * canvas.width + x) * 4 + 3] === 255;
    const outline = [];
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            if (!isFilled(x, y) && (isFilled(x - 1, y) || isFilled(x + 1, y) || isFilled(x, y - 1) || isFilled(x, y + 1))) {
                outline.push([x, y]);
            }
        }
    }
    ctx.fillStyle = "#000000";
    for (const [x, y] of outline) {
        ctx.fillRect(x, y, 1, 1);
    }

    return canvas;
}
