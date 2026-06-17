#!/usr/bin/env python3
"""
Mobius HIVE — 16-bit asset generator.

Produces the crisp pixel-art PNG kit consumed by the world simulator.
Every asset embeds the same STYLE FORMULA:

  Crisp 16-bit SNES-era pixel art on a 32px tile grid, top-down JRPG overworld,
  chunky rounded shapes with clean 1px dark-indigo outlines and dithered shading;
  environment in deep cosmic indigo and violet stone, the Forge castle in warm
  gold and bronze, the player Scout in bright cyan-teal that pops against every
  realm, integrity shards and active beacons marked with a single glowing aqua
  signal; mystical luminous starfield mood; high contrast, clean readable
  silhouettes, consistent top-down perspective across all assets.

Tiles/sprites are authored at logical pixels; the engine scales them up with
nearest-neighbour for the chunky 16-bit feel. Run:  python3 tools/gen_assets.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

# named colours for the detailed parametric character sprites (C-445 detail pass)
OUTLINE = (22, 15, 46, 255)
COL = {
    "steel_d": (52, 62, 92, 255), "steel": (92, 108, 142, 255),
    "steel_l": (150, 170, 205, 255), "steel_h": (214, 228, 244, 255),
    "gold": (232, 168, 60, 255), "gold_l": (246, 205, 96, 255), "gold_d": (150, 100, 30, 255),
    "cape": (74, 63, 120, 255), "cape_d": (48, 40, 80, 255),
    "skin": (216, 160, 112, 255), "skin_d": (168, 112, 63, 255),
    "sat": (122, 74, 38, 255), "sat_l": (168, 106, 54, 255),
    "teal": (61, 255, 234, 255), "teal_h": (180, 255, 246, 255),
    "emer": (47, 214, 160, 255),
    "dark": (16, 12, 34, 255),
    "armor_d": (40, 54, 66, 255), "armor": (66, 86, 100, 255), "armor_l": (110, 140, 156, 255),
}


def add_outline(img, color=OUTLINE):
    """Add a clean 1px dark outline around the sprite silhouette."""
    a = img.split()[3]
    dil = a.filter(ImageFilter.MaxFilter(3))
    res = img.copy(); rp = res.load(); al = a.load(); dl = dil.load()
    for y in range(img.height):
        for x in range(img.width):
            if al[x, y] < 30 and dl[x, y] > 30:
                rp[x, y] = color
    return res

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUT, exist_ok=True)

# ---- HIVE cosmic palette -------------------------------------------------
P = {
    ".": None,                 # transparent
    "0": (22, 15, 46, 255),    # outline / deep void
    "1": (27, 24, 56, 255),    # cosmic ground base
    "2": (38, 34, 78, 255),    # ground dither light
    "3": (52, 46, 110, 255),   # violet stone
    "4": (74, 63, 143, 255),   # violet stone light
    "5": (108, 106, 176, 255), # path stone
    "6": (150, 150, 210, 255), # path highlight
    "7": (61, 255, 234, 255),  # aqua signal (shards/beacon/scout)
    "8": (143, 255, 240, 255), # aqua highlight
    "9": (10, 32, 48, 255),    # dark teal visor
    "a": (232, 197, 71, 255),  # forge gold
    "b": (168, 130, 40, 255),  # bronze shadow
    "c": (255, 244, 214, 255), # warm cream
    "d": (20, 58, 90, 255),    # water deep
    "e": (29, 90, 134, 255),   # water mid
    "f": (61, 214, 255, 255),  # water/cyan crest
    "w": (236, 236, 248, 255), # white robe (tintable)
    "g": (200, 200, 224, 255), # robe shade
    "s": (42, 42, 85, 255),    # star dim
    "S": (90, 90, 150, 255),   # star bright
}


def grid_to_img(rows, scale=1):
    h = len(rows)
    w = len(rows[0])
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        assert len(row) == w, f"row {y} len {len(row)} != {w}"
        for x, ch in enumerate(row):
            col = P.get(ch)
            if col:
                px[x, y] = col
    if scale != 1:
        img = img.resize((w * scale, h * scale), Image.NEAREST)
    return img


def save(img, name):
    img.save(os.path.join(OUT, name))
    print("wrote", name, img.size)


# ---- TILES (32x32, dithered patterns; ground/floor tintable in engine) ---
def tile_ground():
    img = Image.new("RGBA", (32, 32), P["1"])
    px = img.load()
    for y in range(32):
        for x in range(32):
            if (x + y) % 4 == 0:
                px[x, y] = P["2"]
            # sparse starfield specks (deterministic)
            h = (x * 7 + y * 13) % 53
            if h == 0:
                px[x, y] = P["S"]
            elif h == 7:
                px[x, y] = P["s"]
    return img


def tile_path():
    # luminous flagstone road, visually distinct from brick walls
    img = Image.new("RGBA", (32, 32), P["5"])
    px = img.load()
    for y in range(32):
        for x in range(32):
            if x % 16 == 0 or y % 16 == 0:
                px[x, y] = P["3"]          # dark joint
            elif x % 16 == 15 or y % 16 == 15:
                px[x, y] = P["4"]          # shade joint
            elif x % 16 == 1 or y % 16 == 1:
                px[x, y] = P["6"]          # highlight bevel
            if x % 16 == 8 and y % 16 == 8:
                px[x, y] = P["7"]          # aqua glow fleck
    return img


def tile_water():
    img = Image.new("RGBA", (32, 32), P["d"])
    px = img.load()
    for y in range(32):
        for x in range(32):
            wv = (x + (y // 4) * 2) % 8
            if wv < 2:
                px[x, y] = P["e"]
            if y % 8 == 0 and (x + y) % 6 < 2:
                px[x, y] = P["f"]
    return img


def tile_wall():
    img = Image.new("RGBA", (32, 32), P["3"])
    px = img.load()
    for y in range(32):
        for x in range(32):
            row = y // 8
            off = 8 if row % 2 else 0
            if y % 8 in (0, 7) or (x + off) % 16 in (0, 15):
                px[x, y] = P["0"]
            elif y % 8 == 1:
                px[x, y] = P["4"]
    return img


def tile_floor():
    img = Image.new("RGBA", (32, 32), P["4"])
    px = img.load()
    for y in range(32):
        for x in range(32):
            if x % 16 == 0 or y % 16 == 0:
                px[x, y] = P["3"]
            if x % 16 in (1, 15) or y % 16 in (1, 15):
                px[x, y] = P["5"]
            # gold flecks at intersections
            if x % 16 == 8 and y % 16 == 8:
                px[x, y] = P["a"]
    return img


# ---- SCOUT (24x24, 3 frames: down | up | side) — helmeted caped knight -----
# Detailed parametric sprite (C-445): silver helmet, orange scarf, violet cape,
# steel armor with a glowing teal shard at the chest, satchel at the hip.
def _scout_down():
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(6, 12), (18, 12), (21, 23), (3, 23)], fill=COL["cape"])      # cape
    d.polygon([(9, 13), (15, 13), (17, 23), (7, 23)], fill=COL["cape_d"])
    d.rectangle([8, 19, 11, 23], fill=COL["steel_d"])                        # legs
    d.rectangle([13, 19, 16, 23], fill=COL["steel_d"])
    d.rectangle([5, 13, 8, 19], fill=COL["steel"])                           # arms
    d.rectangle([16, 13, 19, 19], fill=COL["steel"])
    d.rectangle([8, 12, 16, 20], fill=COL["steel"])                         # torso
    d.rectangle([8, 12, 16, 13], fill=COL["gold"])                          # scarf
    d.rectangle([5, 12, 9, 15], fill=COL["steel_l"])                        # pauldrons
    d.rectangle([15, 12, 19, 15], fill=COL["steel_l"])
    d.rectangle([3, 16, 8, 21], fill=COL["sat"])                            # satchel
    d.ellipse([6, 2, 17, 12], fill=COL["steel"])                           # helmet dome
    d.rectangle([8, 7, 15, 12], fill=COL["skin"])                          # face
    d.rectangle([6, 7, 8, 12], fill=COL["steel_l"])                        # cheek guards
    d.rectangle([15, 7, 17, 12], fill=COL["steel_l"])
    img = add_outline(img)
    d = ImageDraw.Draw(img)
    d.ellipse([7, 2, 16, 7], fill=COL["steel_l"]); d.rectangle([9, 3, 13, 4], fill=COL["steel_h"])  # helm hi
    d.point([(10, 9), (10, 10)], fill=COL["dark"]); d.point([(13, 9), (13, 10)], fill=COL["dark"])  # eyes
    d.rectangle([11, 15, 12, 16], fill=COL["teal"]); d.point([(11, 14), (12, 17)], fill=COL["teal_h"])  # chest shard
    d.point([(5, 18), (6, 18)], fill=COL["teal"])                           # satchel glint
    return img


def _scout_up():
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(5, 11), (19, 11), (21, 23), (3, 23)], fill=COL["cape"])      # cape (prominent)
    d.polygon([(8, 12), (16, 12), (18, 23), (6, 23)], fill=COL["cape_d"])
    d.rectangle([8, 19, 11, 23], fill=COL["steel_d"])
    d.rectangle([13, 19, 16, 23], fill=COL["steel_d"])
    d.rectangle([5, 12, 9, 15], fill=COL["steel_l"])
    d.rectangle([15, 12, 19, 15], fill=COL["steel_l"])
    d.ellipse([6, 2, 17, 12], fill=COL["steel"])                           # back of helmet
    img = add_outline(img)
    d = ImageDraw.Draw(img)
    d.ellipse([7, 3, 16, 8], fill=COL["steel_l"])
    d.rectangle([10, 12, 13, 19], fill=COL["gold"])                        # cape clasp strip
    return img


def _scout_side():
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(4, 12), (12, 12), (10, 23), (3, 23)], fill=COL["cape"])      # cape trailing back
    d.rectangle([10, 19, 13, 23], fill=COL["steel_d"])                      # legs (stride)
    d.rectangle([14, 19, 17, 23], fill=COL["steel_d"])
    d.rectangle([10, 12, 16, 20], fill=COL["steel"])                       # torso
    d.rectangle([10, 12, 16, 13], fill=COL["gold"])                        # scarf
    d.rectangle([14, 13, 17, 18], fill=COL["steel_l"])                     # front arm
    d.rectangle([7, 15, 11, 20], fill=COL["sat"])                          # satchel
    d.ellipse([9, 2, 18, 12], fill=COL["steel"])                          # helmet
    d.rectangle([13, 7, 18, 11], fill=COL["skin"])                        # face (facing right)
    img = add_outline(img)
    d = ImageDraw.Draw(img)
    d.ellipse([10, 3, 17, 7], fill=COL["steel_l"])
    d.point([(15, 9), (15, 10)], fill=COL["dark"])                         # eye
    d.rectangle([12, 15, 13, 16], fill=COL["teal"]); d.point([(8, 17)], fill=COL["teal_h"])
    return img


def scout_sheet():
    frames = [_scout_down(), _scout_up(), _scout_side()]   # right = side flipped, in engine
    sheet = Image.new("RGBA", (24 * len(frames), 24), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * 24, 0))
    return sheet


# ---- AGENT (24x32 hooded keeper) — gold robe, holding a glowing tablet+shard.
# White robe so the engine can tint it per realm colour; teal/emerald accents
# drawn after tinting via the engine glow, base shown here.
def agent_img():
    img = Image.new("RGBA", (24, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(7, 12), (17, 12), (20, 31), (4, 31)], fill=COL["gold"])      # robe
    d.polygon([(11, 13), (13, 13), (15, 31), (9, 31)], fill=COL["gold_d"])   # center fold
    d.polygon([(7, 12), (9, 12), (6, 31), (4, 31)], fill=COL["gold_l"])      # side fold hi
    d.ellipse([6, 2, 18, 16], fill=COL["gold"])                            # hood
    d.rectangle([9, 7, 15, 15], fill=COL["skin"])                          # face opening
    d.ellipse([6, 2, 18, 9], fill=COL["gold_l"])                           # hood crown hi
    d.rectangle([8, 16, 16, 18], fill=COL["gold_l"])                       # sleeves/arms forward
    d.rectangle([9, 17, 15, 23], fill=COL["sat"])                          # tablet held
    img = add_outline(img)
    d = ImageDraw.Draw(img)
    d.point([(10, 11), (10, 12)], fill=COL["dark"]); d.point([(13, 11), (13, 12)], fill=COL["dark"])  # eyes
    d.rectangle([10, 18, 14, 21], fill=COL["teal"]); d.point([(12, 19)], fill=COL["teal_h"])  # tablet glyph
    d.rectangle([15, 22, 16, 26], fill=COL["emer"])                        # hanging shard
    return img


# ---- SENTINEL (24x32) — armored guardian with spear + glowing chest emblem.
def sentinel_img():
    img = Image.new("RGBA", (24, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([3, 4, 4, 31], fill=COL["armor"])                          # spear shaft
    d.polygon([(1, 0), (6, 0), (3, 7)], fill=COL["armor_l"])               # spearhead
    d.rectangle([9, 24, 12, 31], fill=COL["armor_d"])                      # legs
    d.rectangle([14, 24, 17, 31], fill=COL["armor_d"])
    d.rectangle([8, 12, 18, 25], fill=COL["armor"])                        # torso
    d.rectangle([5, 11, 11, 17], fill=COL["armor_l"])                      # pauldrons
    d.rectangle([15, 11, 21, 17], fill=COL["armor_l"])
    d.rectangle([5, 14, 8, 22], fill=COL["armor_d"])                       # spear arm
    d.rectangle([18, 14, 20, 22], fill=COL["armor"])
    d.ellipse([9, 3, 17, 13], fill=COL["armor_d"])                        # greathelm
    img = add_outline(img)
    d = ImageDraw.Draw(img)
    d.rectangle([10, 7, 16, 8], fill=COL["teal"]); d.point([(11, 7), (15, 7)], fill=COL["teal_h"])  # eye slit
    d.line([(12, 15), (11, 18), (13, 18), (12, 21)], fill=COL["teal"])     # chest lightning emblem
    d.point([(12, 16), (12, 19)], fill=COL["teal_h"])
    d.rectangle([8, 12, 10, 24], fill=COL["armor_l"])                      # armor edge hi
    return img


# ---- SHARD (16x16 aqua crystal) ------------------------------------------
def shard_img():
    rows = [
        "................",
        ".......0........",
        "......070.......",
        "......787.......",
        ".....07870......",
        ".....78887......",
        "....0788870.....",
        "....7888887.....",
        "....0788870.....",
        ".....78887......",
        ".....07870......",
        "......787.......",
        "......070.......",
        ".......0........",
        "................",
        "................",
    ]
    return grid_to_img(rows)


# ---- BEACON sheet (cell 32x48: off | on) ---------------------------------
def beacon_cell(on):
    crys = "7" if on else "4"
    core = "8" if on else "5"
    rows = [
        "................................",
        "..............00................",
        ".............0" + crys + crys + "0...............",
        "............0" + crys + core + core + crys + "0..............",
        "............0" + crys + core + core + crys + "0..............",
        "...........0" + crys + core + core + core + crys + "0.............",
        "...........0" + crys + core + core + core + crys + "0.............",
        "...........0" + crys + crys + core + crys + crys + "0.............",
        "............0" + crys + crys + crys + "0..............",
        ".............0" + crys + crys + "0...............",
        "..............00................",
        ".............0440...............",
        "............043340..............",
        "............043340..............",
        "...........04333340.............",
        "...........04333340.............",
        "...........04333340.............",
        "..........0433aa3340............",
        "..........0433aa3340............",
        "..........0433333340............",
        "..........0433333340............",
        ".........043333333340...........",
        ".........043333333340...........",
        ".........043333333340...........",
        ".........043333333340...........",
        ".........043333333340...........",
        ".........043333333340...........",
        ".........043aaaa3340............",
        ".........0433333333340..........",
        "........04333333333340..........",
        "........0bbbbbbbbbbbb0...........",
        "........0bbbbbbbbbbbb0...........",
        "........043333333333340.........",
        ".......0433333333333340.........",
        ".......0433333333333340.........",
        ".......0433333333333340.........",
        ".......0433333333333340.........",
        ".......0433333333333340.........",
        "......04333333333333340.........",
        "......0bbbbbbbbbbbbbbb0..........",
        "......0bbbbbbbbbbbbbbb0..........",
        "......04444444444444440..........",
        ".......0000000000000000.........",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
    ]
    # normalize widths to 32
    rows = [(r + "." * 32)[:32] for r in rows]
    return grid_to_img(rows)


def beacon_sheet():
    sheet = Image.new("RGBA", (64, 48), (0, 0, 0, 0))
    sheet.paste(beacon_cell(False), (0, 0))
    sheet.paste(beacon_cell(True), (32, 0))
    return sheet


# ---- COSMIC TREE (32x48) -------------------------------------------------
def tree_img():
    rows = []
    canopy = [
        "..............0000..............",
        "...........0003333000...........",
        ".........00333333333300.........",
        "........0333344444433330........",
        ".......033344444444443330.......",
        "......03334444448444444330......",
        "......0334444448884444330.......",
        ".....033444444888844444330......",
        ".....033444444488444444330......",
        "....03344444444444444444330.....",
        "....03344448444444484444330.....",
        "....03344448884444488444330.....",
        "....033444448444444844444330....",
        ".....0334444444444444444330.....",
        ".....03334444444444444330.......",
        "......033344444444444330........",
        ".......0333344444433330.........",
        "........033333333333300.........",
        ".........00333333330000.........",
        "...........00033300.............",
        "..............0b0...............",
        "..............0b0...............",
        ".............0b3b0..............",
        ".............0b3b0..............",
        ".............0b3b0..............",
        ".............0b3b0..............",
        ".............0b3b0..............",
        "............0b333b0.............",
        "............0b333b0.............",
        "............0b333b0.............",
        "...........0bb333bb0............",
        "..........0bb33333bb0...........",
        "..........00.....00.............",
    ]
    for r in canopy:
        rows.append((r + "." * 32)[:32])
    while len(rows) < 48:
        rows.append("." * 32)
    return grid_to_img(rows)


# ---- FOUNTAIN sheet (cell 48x48: locked | active) ------------------------
def fountain_cell(active):
    w = "7" if active else "4"
    c = "8" if active else "5"
    rows = []
    base = [
        "................................................",
        "................................................",
        "...................000000.......................",
        "................0003" + w + w + w + w + "3000....................",
        "..............003" + w + c + c + c + c + w + "300..................",
        ".............03" + w + c + "8" + w + w + "8" + c + w + "30.................",
        "............03" + w + c + w + w + w + w + w + w + c + w + "30................",
        "............03" + w + w + w + w + w + w + w + w + w + w + "30................",
        ".............03" + w + w + w + w + w + w + w + w + "30.................",
        "..............003" + w + w + w + w + w + w + "300..................",
        "................00033" + w + w + "33000....................",
        ".................000a a000......................",
        "..............0000aaaaaaaa0000..................",
        "............00aaaaaaaaaaaaaaaa00................",
        "...........0aaaabbbbbbbbbbaaaa a0...............",
        "...........0aaabb333333333bbaaa0...............",
        "..........0aaab33" + c + c + c + c + c + c + "33baaa0..............",
        "..........0aaab3" + c + w + w + w + w + w + w + c + "3baaa0.............",
        "..........0aaab3" + c + w + w + w + w + w + w + c + "3baaa0.............",
        "..........0aaab33" + c + c + c + c + c + c + "33baaa0..............",
        "...........0aaabb333333333bbaaa0...............",
        "...........0aaaabbbbbbbbbbaaaa0................",
        "............00aaaaaaaaaaaaaa00.................",
        "..............0000aaaaaa0000...................",
        "..............0bbbbbbbbbbbb0...................",
        "..............0bbbbbbbbbbbb0...................",
        "..............0bbbbbbbbbbbb0...................",
        "..............0bbaaaaaaaabb0...................",
        ".............0bbaaaaaaaaaabb0..................",
        ".............0bbbbbbbbbbbbbb0..................",
        ".............0bbbbbbbbbbbbbb0..................",
        "............00000000000000000.................",
        "................................................",
    ]
    for r in base:
        rows.append((r + "." * 48)[:48])
    while len(rows) < 48:
        rows.append("." * 48)
    return grid_to_img(rows)


def fountain_sheet():
    sheet = Image.new("RGBA", (96, 48), (0, 0, 0, 0))
    sheet.paste(fountain_cell(False), (0, 0))
    sheet.paste(fountain_cell(True), (48, 0))
    return sheet


if __name__ == "__main__":
    save(tile_ground(), "ground.png")
    save(tile_path(), "path.png")
    save(tile_water(), "water.png")
    save(tile_wall(), "wall.png")
    save(tile_floor(), "floor.png")
    save(scout_sheet(), "scout.png")
    save(agent_img(), "agent.png")
    save(sentinel_img(), "sentinel.png")
    save(shard_img(), "shard.png")
    save(beacon_sheet(), "beacon.png")
    save(tree_img(), "tree.png")
    save(fountain_sheet(), "fountain.png")
    print("done")
