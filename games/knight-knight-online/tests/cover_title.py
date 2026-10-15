# Crops the in-game screenshot around the fight and puts the title on it, drawn the way the game draws its own title
import os, sys
from PIL import Image, ImageDraw
ROOT = r"C:\Users\milo\Documents\GitHub\MDogEngine"
DRAFTS = os.path.join(ROOT, "games", "knight-knight-online", "cover-drafts")
ALPH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!~-.,?[]/:*'\"><_"
FONT = Image.open(os.path.join(ROOT, "assets", "fonts", "marsfont.png")).convert("RGBA")
left, top, width, height, scale = 66, 56, 136, 102, 8
shot = Image.open(os.path.join(DRAFTS, "cover-ingame-raw.png")).convert("RGBA").crop((left, top, left + width, top + height))

def text_mask(text):
    mask = Image.new("L", (len(text) * 5 - 1, 5), 0)
    for i, char in enumerate(text):
        index = ALPH.find(char)
        if index >= 0:
            mask.paste(FONT.crop((index * 5, 0, index * 5 + 5, 5)).split()[3], (i * 5, 0))
    return mask

# The game's drawText: centered, a dark copy one (scaled) pixel down, then the color
def draw_text(canvas, text, center_x, center_y, color, size):
    mask = text_mask(text)
    mask = mask.resize((mask.width * size, mask.height * size), Image.NEAREST)
    x = center_x - (mask.width // size // 2) * size
    y = center_y - 2 * size
    canvas.paste(Image.new("RGBA", mask.size, (0x1c, 0x2a, 0x18, 255)), (x, y + size), mask)
    canvas.paste(Image.new("RGBA", mask.size, color), (x, y), mask)

# The boulder's trail: the track it flattened in the grass, like the wake behind a boat. Its two edges start where
# the game's track is at the left edge of the shot, and come together in a point right behind the boulder. (The game
# draws the same track, but so faint, to not clutter a match, that it barely shows.) It goes under the boulder, with
# a puff of dust just behind it.
import json
scene_file = os.path.join(DRAFTS, "cover-ingame-raw.json")
if os.path.exists(scene_file):
    boulder = json.load(open(scene_file))["boulder"]
    size = boulder["size"]
    track_y = boulder["y"] + size - 2 - top
    half = size * 0.5 / 2
    tip_x = boulder["x"] - left + size / 2  # the point: the middle of the boulder (it's drawn over the end)
    trail = Image.new("RGBA", shot.size, (0, 0, 0, 0))
    pixels = trail.load()
    for x in range(0, int(tip_x) + 1):
        along = x / tip_x  # 0 at the left edge, 1 at the boulder
        spread = half * (1 - along)
        fade = 0.35 + 0.65 * along
        upper = round(track_y - spread)
        lower = round(track_y + spread)
        for y in range(upper + 1, lower):
            pixels[x, y] = (210, 235, 170, int(45 * fade))
        for y in {upper, lower}:
            if 0 <= y < shot.height:
                pixels[x, y] = (30, 50, 20, int(110 * fade))
        # Darker dots along both edges every few pixels, like the game's track, closing in with them
        if x % 3 == 0:
            for y in {upper - 1, lower + 1}:
                if 0 <= y < shot.height:
                    pixels[x, y] = (30, 50, 20, int(150 * fade))
    shot.alpha_composite(trail)
    dust = ImageDraw.Draw(shot)
    back = boulder["x"] - left + 2
    for dx, dy, shade in ((-2, -2, 220), (-4, 1, 200), (-6, -1, 180), (-3, 3, 200), (-8, 2, 170)):
        dust.point((back + dx, track_y + dy), fill=(shade, shade - 20, shade - 60, 200))
    # The boulder goes back on top: its own pixels from the screenshot (grey, unlike the grass around it)
    raw = Image.open(os.path.join(DRAFTS, "cover-ingame-raw.png")).convert("RGBA")
    raw_pixels = raw.load()
    shot_pixels = shot.load()
    bx, by = int(boulder["x"]), int(boulder["y"])
    for y in range(by - 1, by + size + 1):
        for x in range(bx - 1, bx + size + 1):
            r, g, b, a = raw_pixels[x, y]
            if abs(r - g) < 30 and abs(g - b) < 30 and 0 <= x - left < shot.width and 0 <= y - top < shot.height:
                shot_pixels[x - left, y - top] = (r, g, b, a)

# Two more z's coming off the sleeping bear, to the left of the one the game draws, each a little lower, drawn the way
# the game draws its z (the font's "z", white and a little see-through)
if os.path.exists(scene_file):
    bear = json.load(open(scene_file)).get("bear")
    if bear is not None:
        rise = (bear["ticks"] % 90) / 90
        z_x = round(bear["x"] + 6 + rise * 4) - left
        z_y = round(bear["y"] - 12 - rise * 10) - top
        glyph = text_mask("z")
        for step in (1, 2):
            x = z_x - 6 * step - 2
            y = z_y + step - 2
            layer = Image.new("RGBA", shot.size, (0, 0, 0, 0))
            layer.paste(Image.new("RGBA", glyph.size, (255, 255, 255, 204)), (x, y), glyph)
            shot.alpha_composite(layer)

band = Image.new("RGBA", shot.size, (0, 0, 0, 0))
ImageDraw.Draw(band).rectangle((0, 0, width, 22), fill=(10, 16, 10, 140))
shot.alpha_composite(band)
draw_text(shot, "KNIGHT KNIGHT", width // 2, 11, (0xff, 0xd8, 0x4a, 255), 2)
shot.resize((width * scale, height * scale), Image.NEAREST).convert("RGB").save(os.path.join(DRAFTS, "cover-ingame.png"))
print("saved", width * scale, "x", height * scale)
