# Shrinks the arena screenshots from arena-thumbs.mjs into the arena picker's pictures (40 x 30, a sixth of the
# game's size), in assets/knight-knight-online/. python arena_thumbs.py <screenshot folder>
import os, sys
from PIL import Image, ImageEnhance

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "..", "..", "assets", "knight-knight-online")
os.makedirs(out, exist_ok=True)
for name in sorted(os.listdir(sys.argv[1])):
    image = Image.open(os.path.join(sys.argv[1], name)).convert("RGB")
    small = image.resize((40, 30), Image.BOX)
    # A little crisper and brighter, so it reads that small (the dark arenas especially)
    small = ImageEnhance.Contrast(small).enhance(1.15)
    small = ImageEnhance.Brightness(small).enhance(1.15)
    small.save(os.path.join(out, "arena-" + name))
    print("arena-" + name)
