// Minecraft's font, read from its font sheet (ascii.png): a 16x16 grid of 8x8 characters in ASCII order.
// Like Minecraft, each character's width is measured from its pixels, and characters are spaced 1 pixel apart.
// Row 7 of each character is below the baseline, for descenders (g, j, p, q, y, and ,).

const CELL_SIZE = 8;
const SPACE_ADVANCE = 4; // From Minecraft's font/include/space.json

let sheet = null;
const glyphWidths = new Map(); // char code -> width in pixels

function glyphCode(char) {
    const code = char.charCodeAt(0);
    return glyphWidths.has(code) ? code : "?".charCodeAt(0);
}

function advance(char) {
    return char === " " ? SPACE_ADVANCE : glyphWidths.get(glyphCode(char)) + 1;
}

// Minecraft style drop shadow: the same color at a quarter of the brightness. Color must be "#rrggbb".
function shadowColor(color) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) >> 2;
    const g = parseInt(hex.substring(2, 4), 16) >> 2;
    const b = parseInt(hex.substring(4, 6), 16) >> 2;
    return `rgb(${r}, ${g}, ${b})`;
}

function makeCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    canvas.getContext("2d").imageSmoothingEnabled = false;
    return canvas;
}

// The text in one solid color
function renderColored(text, color) {
    const canvas = makeCanvas(PixelFont.measure(text), CELL_SIZE);
    const ctx = canvas.getContext("2d");

    let x = 0;
    for (const char of text) {
        if (char !== " ") {
            const code = glyphCode(char);
            ctx.drawImage(sheet, (code % 16) * CELL_SIZE, Math.floor(code / 16) * CELL_SIZE, CELL_SIZE, CELL_SIZE, x, 0, CELL_SIZE, CELL_SIZE);
        }
        x += advance(char);
    }

    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
}

class PixelFont {
    static height = CELL_SIZE;

    // Must finish before measure() or render() are used
    static load(path) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const reader = makeCanvas(image.width, image.height).getContext("2d");
                reader.drawImage(image, 0, 0);
                const data = reader.getImageData(0, 0, image.width, image.height).data;

                // Printable ASCII only. Width is the rightmost column with any pixels in it.
                for (let code = 33; code < 127; code++) {
                    const cellX = (code % 16) * CELL_SIZE;
                    const cellY = Math.floor(code / 16) * CELL_SIZE;
                    let width = 0;
                    for (let y = 0; y < CELL_SIZE; y++) {
                        for (let x = 0; x < CELL_SIZE; x++) {
                            if (data[((cellY + y) * image.width + cellX + x) * 4 + 3] > 0) {
                                width = Math.max(width, x + 1);
                            }
                        }
                    }
                    if (width > 0) {
                        glyphWidths.set(code, width);
                    }
                }

                sheet = image;
                resolve();
            };
            image.onerror = () => reject(new Error("Failed to load font " + path));
            image.src = path;
        });
    }

    // Width of the text in pixels, not counting the shadow
    static measure(text) {
        let width = 0;
        for (const char of text) {
            width += advance(char);
        }
        return Math.max(0, width - 1);
    }

    // Settings - shadow (default true)
    // Returns - a canvas with the text drawn on it
    static render(text, color, settings) {
        settings = settings ?? {};
        const shadow = settings.shadow ?? true;

        if (!shadow) {
            return renderColored(text, color);
        }

        const canvas = makeCanvas(PixelFont.measure(text) + 1, CELL_SIZE + 1);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(renderColored(text, shadowColor(color)), 1, 1);
        ctx.drawImage(renderColored(text, color), 0, 0);
        return canvas;
    }
}

export default PixelFont;
