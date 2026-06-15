// Minimal Tiled (.tmj) map loader + renderer.
// Supports: orthogonal CSV tile layers, one tileset image, object groups
// (exits, spawn point, signal nodes) read as plain rectangles with
// `properties` flattened into a {name: value} map for convenience.

export async function loadMap(tmjUrl, baseUrl) {
  const map = await (await fetch(tmjUrl)).json();
  const ts = map.tilesets[0];
  const image = new Image();
  const imgReady = new Promise(res => { image.onload = res; image.onerror = res; });
  image.src = new URL(ts.image, baseUrl).href;
  await imgReady;

  const tileLayers = map.layers.filter(l => l.type === "tilelayer");
  const objects = {};
  for (const l of map.layers) {
    if (l.type !== "objectgroup") continue;
    for (const o of l.objects) {
      const props = {};
      for (const p of o.properties || []) props[p.name] = p.value;
      objects[o.name] = { ...o, props };
    }
  }

  const cols = ts.columns, tw = ts.tilewidth, th = ts.tileheight, firstgid = ts.firstgid;

  function drawLayer(ctx, layer, camX, camY, viewW, viewH) {
    const x0 = Math.max(0, Math.floor(camX / tw));
    const y0 = Math.max(0, Math.floor(camY / th));
    const x1 = Math.min(map.width, Math.ceil((camX + viewW) / tw));
    const y1 = Math.min(map.height, Math.ceil((camY + viewH) / th));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const gid = layer.data[y * map.width + x];
        if (!gid) continue;
        const id = gid - firstgid;
        const sx = (id % cols) * tw, sy = Math.floor(id / cols) * th;
        ctx.drawImage(image, sx, sy, tw, th, x * tw, y * th, tw, th);
      }
    }
  }

  return {
    map, image, objects, tileWidth: tw, tileHeight: th,
    widthPx: map.width * tw, heightPx: map.height * th,
    render(ctx, camX, camY, viewW, viewH) {
      for (const layer of tileLayers) drawLayer(ctx, layer, camX, camY, viewW, viewH);
    },
    // axis-aligned solid check against decor layer (anything nonzero on the
    // top tile layer beyond index 0 is treated as solid — buildings/trees).
    isSolid(px, py) {
      const tx = Math.floor(px / tw), ty = Math.floor(py / th);
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
      const decor = tileLayers[tileLayers.length - 1];
      const id = decor.data[ty * map.width + tx];
      if (!id) return false;
      const local = id - firstgid;
      // ROOF/WALL/TREE/FOUNTAIN/CRATE tiles occupy ids 8..14 on row 1 (cols 0-6)
      return local >= 8 && local <= 14;
    },
    rect(name) {
      const o = objects[name]; if (!o) return null;
      return { x: o.x, y: o.y, w: o.width, h: o.height, props: o.props };
    },
    allOf(type) {
      return Object.values(objects).filter(o => o.type === type);
    }
  };
}
