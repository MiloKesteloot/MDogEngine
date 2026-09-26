// A small blocky bitmap font, drawn in code so no font files are needed.
// Every glyph is 8 rows tall: rows 0-6 sit on the baseline and row 7 is for descenders (g, j, p, q, y, and ,).
// A glyph's width is the length of its rows, and letters are spaced 1 pixel apart.

const GLYPH_HEIGHT = 8;

const GLYPHS = {};

// rows is a space separated list of rows, starting at row `top`. "#" is a filled pixel.
function glyph(char, top, rows) {
    const lines = rows.split(" ");
    const width = lines[0].length;
    const fullRows = [];
    for (let i = 0; i < GLYPH_HEIGHT; i++) {
        fullRows.push(lines[i - top] ?? ".".repeat(width));
    }
    GLYPHS[char] = fullRows;
}

glyph(" ", 0, "...");

glyph("A", 0, ".###. #...# #...# ##### #...# #...# #...#");
glyph("B", 0, "####. #...# ####. #...# #...# #...# ####.");
glyph("C", 0, ".###. #...# #.... #.... #.... #...# .###.");
glyph("D", 0, "####. #...# #...# #...# #...# #...# ####.");
glyph("E", 0, "##### #.... ###.. #.... #.... #.... #####");
glyph("F", 0, "##### #.... ###.. #.... #.... #.... #....");
glyph("G", 0, ".#### #.... #..## #...# #...# #...# .###.");
glyph("H", 0, "#...# #...# ##### #...# #...# #...# #...#");
glyph("I", 0, "### .#. .#. .#. .#. .#. ###");
glyph("J", 0, "....# ....# ....# ....# ....# #...# .###.");
glyph("K", 0, "#...# #..#. ###.. #..#. #...# #...# #...#");
glyph("L", 0, "#.... #.... #.... #.... #.... #.... #####");
glyph("M", 0, "#...# ##.## #.#.# #...# #...# #...# #...#");
glyph("N", 0, "#...# ##..# #.#.# #..## #...# #...# #...#");
glyph("O", 0, ".###. #...# #...# #...# #...# #...# .###.");
glyph("P", 0, "####. #...# ####. #.... #.... #.... #....");
glyph("Q", 0, ".###. #...# #...# #...# #...# #..#. .##.#");
glyph("R", 0, "####. #...# ####. #...# #...# #...# #...#");
glyph("S", 0, ".#### #.... .###. ....# ....# #...# .###.");
glyph("T", 0, "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..");
glyph("U", 0, "#...# #...# #...# #...# #...# #...# .###.");
glyph("V", 0, "#...# #...# #...# #...# .#.#. .#.#. ..#..");
glyph("W", 0, "#...# #...# #...# #...# #.#.# ##.## #...#");
glyph("X", 0, "#...# .#.#. ..#.. .#.#. #...# #...# #...#");
glyph("Y", 0, "#...# .#.#. ..#.. ..#.. ..#.. ..#.. ..#..");
glyph("Z", 0, "##### ....# ...#. ..#.. .#... #.... #####");

glyph("a", 2, ".###. ....# .#### #...# .####");
glyph("b", 0, "#.... #.... #.##. ##..# #...# #...# ####.");
glyph("c", 2, ".###. #...# #.... #...# .###.");
glyph("d", 0, "....# ....# .##.# #..## #...# #...# .####");
glyph("e", 2, ".###. #...# ##### #.... .####");
glyph("f", 0, "..## .#.. #### .#.. .#.. .#.. .#..");
glyph("g", 2, ".#### #...# #...# .#### ....# ####.");
glyph("h", 0, "#.... #.... #.##. ##..# #...# #...# #...#");
glyph("i", 0, "# . # # # # #");
glyph("j", 0, "....# ..... ....# ....# ....# ....# #...# .###.");
glyph("k", 0, "#... #... #..# #.#. ##.. #.#. #..#");
glyph("l", 0, "#. #. #. #. #. #. .#");
glyph("m", 2, "##.#. #.#.# #.#.# #...# #...#");
glyph("n", 2, "####. #...# #...# #...# #...#");
glyph("o", 2, ".###. #...# #...# #...# .###.");
glyph("p", 2, "#.##. ##..# #...# ####. #.... #....");
glyph("q", 2, ".##.# #..## #...# .#### ....# ....#");
glyph("r", 2, "#.##. ##..# #.... #.... #....");
glyph("s", 2, ".#### #.... .###. ....# ####.");
glyph("t", 1, ".#. ### .#. .#. .#. ..#");
glyph("u", 2, "#...# #...# #...# #...# .####");
glyph("v", 2, "#...# #...# #...# .#.#. ..#..");
glyph("w", 2, "#...# #...# #.#.# #.#.# .####");
glyph("x", 2, "#...# .#.#. ..#.. .#.#. #...#");
glyph("y", 2, "#...# #...# #...# .#### ....# ####.");
glyph("z", 2, "##### ...#. ..#.. .#... #####");

glyph("0", 0, ".###. #...# #..## #.#.# ##..# #...# .###.");
glyph("1", 0, "..#.. .##.. ..#.. ..#.. ..#.. ..#.. #####");
glyph("2", 0, ".###. #...# ....# ..##. .#... #...# #####");
glyph("3", 0, ".###. #...# ....# ..##. ....# #...# .###.");
glyph("4", 0, "...## ..#.# .#..# #...# ##### ....# ....#");
glyph("5", 0, "##### #.... ####. ....# ....# #...# .###.");
glyph("6", 0, "..##. .#... #.... ####. #...# #...# .###.");
glyph("7", 0, "##### #...# ....# ...#. ..#.. ..#.. ..#..");
glyph("8", 0, ".###. #...# #...# .###. #...# #...# .###.");
glyph("9", 0, ".###. #...# #...# .#### ....# ...#. .##..");

glyph(".", 6, "#");
glyph(",", 6, "# #");
glyph("!", 0, "# # # # # . #");
glyph("?", 0, ".###. #...# ....# ...#. ..#.. ..... ..#..");
glyph(":", 2, "# . . . #");
glyph(";", 2, "# . . . # #");
glyph("'", 0, "# #");
glyph("\"", 0, "#.# #.#");
glyph("-", 4, "#####");
glyph("_", 7, "#####");
glyph("+", 2, "..#.. ..#.. ##### ..#.. ..#..");
glyph("=", 3, "##### ..... #####");
glyph("/", 0, "....# ...#. ...#. ..#.. .#... .#... #....");
glyph("(", 0, "..# .#. #.. #.. #.. .#. ..#");
glyph(")", 0, "#.. .#. ..# ..# ..# .#. #..");
glyph("[", 0, "### #.. #.. #.. #.. #.. ###");
glyph("]", 0, "### ..# ..# ..# ..# ..# ###");
glyph("<", 0, "...# ..#. .#.. #... .#.. ..#. ...#");
glyph(">", 0, "#... .#.. ..#. ...# ..#. .#.. #...");
glyph("%", 0, "#...# #..#. ...#. ..#.. .#... .#..# #...#");

function getGlyph(char) {
    return GLYPHS[char] ?? GLYPHS["?"];
}

// Minecraft style drop shadow: the same color at a quarter of the brightness. Color must be "#rrggbb".
function shadowColor(color) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) >> 2;
    const g = parseInt(hex.substring(2, 4), 16) >> 2;
    const b = parseInt(hex.substring(4, 6), 16) >> 2;
    return `rgb(${r}, ${g}, ${b})`;
}

function drawGlyphs(ctx, text, x, y, color) {
    ctx.fillStyle = color;
    for (const char of text) {
        const rows = getGlyph(char);
        for (let row = 0; row < rows.length; row++) {
            for (let column = 0; column < rows[row].length; column++) {
                if (rows[row][column] === "#") {
                    ctx.fillRect(x + column, y + row, 1, 1);
                }
            }
        }
        x += rows[0].length + 1;
    }
}

class PixelFont {
    static height = GLYPH_HEIGHT;

    static glyphs = GLYPHS;

    // Width of the text in pixels, not counting the shadow
    static measure(text) {
        let width = 0;
        for (const char of text) {
            width += getGlyph(char)[0].length + 1;
        }
        return Math.max(0, width - 1);
    }

    // Settings - shadow (default true)
    // Returns - a canvas with the text drawn on it, which can be drawn with MDog.Draw._rawImage
    static render(text, color, settings) {
        settings = settings ?? {};
        const shadow = settings.shadow ?? true;

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, PixelFont.measure(text) + (shadow ? 1 : 0));
        canvas.height = GLYPH_HEIGHT + (shadow ? 1 : 0);
        const ctx = canvas.getContext("2d");

        if (shadow) {
            drawGlyphs(ctx, text, 1, 1, shadowColor(color));
        }
        drawGlyphs(ctx, text, 0, 0, color);

        return canvas;
    }
}

export default PixelFont;
