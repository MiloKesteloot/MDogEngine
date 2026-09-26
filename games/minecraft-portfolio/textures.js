import PixelFont from "./PixelFont.js";

// Everything here is generated in code and drawn once into a canvas at startup,
// so the menu only has to copy finished images each tick.

export function makeCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").imageSmoothingEnabled = false;
    return canvas;
}

// Seeded random so the textures look the same every time the page loads (mulberry32)
function seededRandom(seed) {
    return function() {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function rgb(color, brightnessShift) {
    const shift = brightnessShift ?? 0;
    const r = Math.max(0, Math.min(255, Math.round(color[0] + shift)));
    const g = Math.max(0, Math.min(255, Math.round(color[1] + shift)));
    const b = Math.max(0, Math.min(255, Math.round(color[2] + shift)));
    return `rgb(${r}, ${g}, ${b})`;
}

// [color, weight]
const DIRT_PALETTE = [
    ["#866043", 40],
    ["#79553a", 25],
    ["#9b7653", 15],
    ["#593d29", 12],
    ["#b9855c", 5],
    ["#747474", 3],
];

function makeDirtTile() {
    const random = seededRandom(1);
    const totalWeight = DIRT_PALETTE.reduce((sum, entry) => sum + entry[1], 0);

    const tile = makeCanvas(16, 16);
    const ctx = tile.getContext("2d");
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            let pick = random() * totalWeight;
            let color = DIRT_PALETTE[0][0];
            for (const [paletteColor, weight] of DIRT_PALETTE) {
                pick -= weight;
                if (pick < 0) {
                    color = paletteColor;
                    break;
                }
            }
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return tile;
}

// Tiled dirt, darkened like Minecraft's menu backgrounds. brightness is 0 to 1.
export function makeDirtBackground(width, height, tileScale, brightness) {
    const tile = makeDirtTile();
    const tileSize = 16 * tileScale;

    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext("2d");
    for (let y = 0; y < height; y += tileSize) {
        for (let x = 0; x < width; x += tileSize) {
            ctx.drawImage(tile, x, y, tileSize, tileSize);
        }
    }
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - brightness})`;
    ctx.fillRect(0, 0, width, height);
    return canvas;
}

const BUTTON_STYLES = {
    normal:   {base: [111, 111, 111], light: [170, 170, 170], dark: [86, 86, 86],  text: "#e0e0e0"},
    hover:    {base: [126, 136, 191], light: [188, 196, 248], dark: [87, 95, 137], text: "#ffffa0"},
    disabled: {base: [44, 44, 44],    light: [58, 58, 58],    dark: [36, 36, 36],  text: "#a0a0a0"},
};

// state is "normal", "hover", or "disabled"
export function makeButton(label, width, height, state) {
    const style = BUTTON_STYLES[state];
    const random = seededRandom(7); // Same seed for every state, so hovering only changes the color

    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext("2d");

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const noise = (random() - 0.5) * 12;

            if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
                ctx.fillStyle = "#000000";
            } else if (x === 1 || y === 1) {
                ctx.fillStyle = rgb(style.light, noise / 2);
            } else if (x === width - 2 || y >= height - 3) {
                ctx.fillStyle = rgb(style.dark, noise / 2);
            } else {
                ctx.fillStyle = rgb(style.base, noise);
            }
            ctx.fillRect(x, y, 1, 1);
        }
    }

    const text = PixelFont.render(label, style.text);
    const textX = Math.floor((width - PixelFont.measure(label)) / 2);
    const textY = Math.floor((height - PixelFont.height) / 2);
    ctx.drawImage(text, textX, textY);

    return canvas;
}

// Big blocky stone letters with a 3D side and a black outline, in the style of the Minecraft logo.
// blockSize is how many pixels each font pixel becomes, depth is how far the 3D side sticks out.
export function makeLogo(text, blockSize, depth) {
    const mask = PixelFont.render(text, "#ffffff", {shadow: false});
    const maskData = mask.getContext("2d").getImageData(0, 0, mask.width, mask.height).data;
    const isOn = (x, y) => x >= 0 && y >= 0 && x < mask.width && y < mask.height && maskData[(y * mask.width + x) * 4 + 3] > 0;

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
    const random = seededRandom(3);

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

    // Front face: noisy stone with lighter top/left edges and darker bottom/right edges
    for (let y = 0; y < rowCount; y++) {
        for (let x = 0; x < mask.width; x++) {
            if (!isOn(x, y)) continue;
            for (let j = 0; j < blockSize; j++) {
                for (let i = 0; i < blockSize; i++) {
                    let shade = 150 + (random() - 0.5) * 36;
                    if (j === 0 && !isOn(x, y - 1)) shade = 215;
                    else if (i === 0 && !isOn(x - 1, y)) shade = 190;
                    else if (j === blockSize - 1 && !isOn(x, y + 1)) shade = 115;
                    else if (i === blockSize - 1 && !isOn(x + 1, y)) shade = 125;
                    ctx.fillStyle = rgb([shade, shade, shade]);
                    ctx.fillRect(padding + x * blockSize + i, padding + y * blockSize + j, 1, 1);
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

// Yellow tilted splash text. Drawn at 2x, then rotated with smoothing so the tilted letters stay readable.
// Like Minecraft, long splashes are shrunk, here so they are at most maxWidth pixels wide before rotating.
export function makeSplash(text, color, angleDegrees, maxWidth) {
    const scale = 2;
    const small = PixelFont.render(text, color);
    const big = makeCanvas(small.width * scale, small.height * scale);
    big.getContext("2d").drawImage(small, 0, 0, big.width, big.height);

    const fit = Math.min(1, maxWidth / big.width);
    const width = big.width * fit;
    const height = big.height * fit;

    const size = Math.ceil(Math.hypot(width, height)) + 2;
    const canvas = makeCanvas(size, size);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.translate(size / 2, size / 2);
    ctx.rotate(angleDegrees * Math.PI / 180);
    ctx.drawImage(big, -width / 2, -height / 2, width, height);
    return canvas;
}
