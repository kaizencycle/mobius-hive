#!/usr/bin/env python3
"""Generate the Higgsfield deploy cards: 16:9 thumbnail + 1:1 favicon.

Composes the game's own 16-bit pixel-art kit into share cards so the catalog
art matches the game. Writes to /tmp by default (cards are deploy metadata, not
committed game assets). Run: python3 tools/gen_cards.py [outdir]
"""
import os, sys, math
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(__file__)
A = os.path.join(HERE, "..", "assets")
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"


def load(n):
    return Image.open(os.path.join(A, n)).convert("RGBA")


def up(img, s):
    return img.resize((img.width * s, img.height * s), Image.NEAREST)


def bg(w, h):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    px = img.load()
    for y in range(h):
        t = y / h
        r = int(11 + t * 16); g = int(10 + t * 14); b = int(31 + t * 30)
        for x in range(w):
            px[x, y] = (r, g, b, 255)
    # starfield
    for i in range(int(w * h / 900)):
        x = (i * 9973) % w; y = (i * 7919) % h
        c = 70 if i % 3 else 150
        px[x, y] = (c, c, min(255, c + 60), 255)
    return img


def pixel_text(draw_img, text, scale, color, cx, cy, shadow=(0, 0, 0, 180)):
    """Render text with the default bitmap font, scaled up with NEAREST for a
    chunky pixel look, centred on (cx, cy)."""
    font = ImageFont.load_default()
    tmp = Image.new("RGBA", (len(text) * 7 + 4, 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(tmp)
    d.text((1, 0), text, font=font, fill=color)
    big = tmp.resize((tmp.width * scale, tmp.height * scale), Image.NEAREST)
    sh = Image.new("RGBA", big.size, (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    tmp2 = Image.new("RGBA", tmp.size, (0, 0, 0, 0))
    ImageDraw.Draw(tmp2).text((1, 0), text, font=font, fill=shadow)
    big_sh = tmp2.resize(big.size, Image.NEAREST)
    x = int(cx - big.width / 2); y = int(cy - big.height / 2)
    draw_img.alpha_composite(big_sh, (x + scale, y + scale))
    draw_img.alpha_composite(big, (x, y))


def thumbnail():
    W, H = 1280, 720
    img = bg(W, H)
    # ground strip
    ground = load("ground.png")
    s = 4
    gt = up(ground, s)
    for x in range(0, W, gt.width):
        img.alpha_composite(gt, (x, H - gt.height * 2))
        img.alpha_composite(gt, (x, H - gt.height))
    # path band
    path = up(load("path.png"), s)
    for x in range(0, W, path.width):
        img.alpha_composite(path, (x, H - gt.height - path.height // 2))
    # scene actors
    fount = up(load("fountain.png").crop((48, 0, 96, 48)), 5)   # active fountain
    img.alpha_composite(fount, (W // 2 - fount.width // 2, H - fount.height - 150))
    beac_on = up(load("beacon.png").crop((32, 0, 64, 48)), 4)
    img.alpha_composite(beac_on, (210, H - beac_on.height - 170))
    img.alpha_composite(up(load("beacon.png").crop((32, 0, 64, 48)), 4), (W - 320, H - beac_on.height - 170))
    scout = up(load("scout.png").crop((0, 0, 16, 16)), 8)
    img.alpha_composite(scout, (W // 2 - scout.width // 2, H - scout.height - 120))
    for i, x in enumerate((360, 520, 760, 920)):
        img.alpha_composite(up(load("shard.png"), 5), (x, H - 280 - (i % 2) * 30))
    # glow behind title
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    dg.ellipse((W//2-460, 120, W//2+460, 360), fill=(61, 255, 234, 26))
    img.alpha_composite(glow)
    # titles
    pixel_text(img, "MOBIUS  HIVE", 13, (232, 197, 71, 255), W // 2, 200)
    pixel_text(img, "16-BIT  WORLD  SIMULATOR", 6, (61, 255, 234, 255), W // 2, 300)
    pixel_text(img, "CYCLE C-344  -  RESTORE THE BEACON", 4, (200, 200, 232, 255), W // 2, 360)
    img.convert("RGB").save(os.path.join(OUT, "hive_thumb.png"))
    print("thumbnail ->", os.path.join(OUT, "hive_thumb.png"))


def favicon():
    W = 512
    img = bg(W, W)
    # gold ring
    d = ImageDraw.Draw(img)
    for r, a in ((210, 60), (200, 120), (190, 200)):
        d.ellipse((W//2-r, W//2-r, W//2+r, W//2+r), outline=(232, 197, 71, a), width=6)
    # big shard
    shard = up(load("shard.png"), 22)
    img.alpha_composite(shard, (W // 2 - shard.width // 2, W // 2 - shard.height // 2 - 26))
    pixel_text(img, "HIVE", 10, (61, 255, 234, 255), W // 2, W - 92)
    img.convert("RGB").save(os.path.join(OUT, "hive_favicon.png"))
    print("favicon ->", os.path.join(OUT, "hive_favicon.png"))


if __name__ == "__main__":
    thumbnail()
    favicon()
