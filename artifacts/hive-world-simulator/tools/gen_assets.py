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
from PIL import Image

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


# ---- SCOUT sheet (8 frames of 16x16: down0 down1 up0 up1 left0 left1 r0 r1)
def scout_frame(direction, step):
    # base 16x16 hooded top-down figure, cyan body
    rows = [
        "................",
        "......0000......",
        ".....070070.....",  # hood with aqua trim
        "....07788770....",
        "....07888870....",
        "....09888890....",  # visor band
        ".....077770.....",
        "....0788870.....",  # shoulders
        "...078888870....",
        "...078888870....",
        "...078787870....",  # belt line
        "...078888870....",
        "....07888700....",
        ".....00..00.....",
        "................",
        "................",
    ]
    img = grid_to_img(rows)
    px = img.load()
    # feet step animation
    if step == 0:
        for x in (5, 6):
            px[x, 13] = P["9"]
        for x in (9, 10):
            px[x, 14] = P["9"]
    else:
        for x in (5, 6):
            px[x, 14] = P["9"]
        for x in (9, 10):
            px[x, 13] = P["9"]
    # facing tweaks
    if direction == "up":
        # hide visor (back of head)
        for x in range(16):
            if px[x, 5] == P["9"]:
                px[x, 5] = P["7"]
    elif direction in ("left", "right"):
        # shift visor to a side eye
        for x in range(16):
            if px[x, 5] == P["9"]:
                px[x, 5] = P["7"]
        ex = 5 if direction == "left" else 10
        px[ex, 5] = P["9"]
        px[ex, 6] = P["9"]
    if direction == "right":
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    return img


def scout_sheet():
    frames = []
    for d in ("down", "up", "left", "right"):
        for s in (0, 1):
            frames.append(scout_frame(d, s))
    sheet = Image.new("RGBA", (16 * len(frames), 16), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * 16, 0))
    return sheet


# ---- AGENT (16x24 robed keeper; white robe tinted per realm in engine) ---
def agent_img():
    rows = [
        "................",
        "......0000......",
        ".....0wwww0.....",  # head/hood
        ".....0wccw0.....",
        ".....0cwwc0.....",
        "......0ww0......",
        ".....0wwww0.....",  # collar
        "....0wwwwww0....",
        "....0wgwwgw0....",
        "....0wwwwww0....",
        "....0wwggww0....",
        "....0wwwwww0....",
        "...0wwwwwwww0...",
        "...0wwgwwgww0...",
        "...0wwwwwwww0...",
        "...0wwwwwwww0...",
        "...0wwggggww0...",
        "...0wwwwwwww0...",
        "...0wwwwwwww0...",
        "..0wwwwwwwwww0..",
        "..0wwwwwwwwww0..",
        "..0wwwwwwwwww0..",
        "..0w00wwww00w0..",
        "...00......00...",
    ]
    return grid_to_img(rows)


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
    save(shard_img(), "shard.png")
    save(beacon_sheet(), "beacon.png")
    save(tree_img(), "tree.png")
    save(fountain_sheet(), "fountain.png")
    print("done")
