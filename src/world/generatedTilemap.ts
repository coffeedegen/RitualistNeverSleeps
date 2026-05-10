export type RitualTileId =
  | "base_floor"
  | "cracked_floor"
  | "moss_floor"
  | "mud_floor"
  | "north_border"
  | "south_border"
  | "west_border"
  | "east_border"
  | "rune_floor"
  | "blood_stain"
  | "altar_tile"
  | "void_tile"
  | "path_tile"
  | "gravel_tile"
  | "water_tile"
  | "grass_tile"
  | "sigil_tile"
  | "broken_tile";

export type RitualPropId =
  | "pillar"
  | "torch_candle"
  | "statue"
  | "crate_barrel"
  | "bone_pile"
  | "reliquary_decor"
  | "broken_monument"
  | "skull_pile";

export interface GeneratedPropPlacement {
  id: RitualPropId;
  col: number;
  row: number;
}

export interface GeneratedTilemapData {
  width: number;
  height: number;
  tileSize: number;
  originX: number;
  originY: number;
  tiles: RitualTileId[];
  props: GeneratedPropPlacement[];
}

export interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const TILESET_SIZE = 64;
const MAP_WIDTH = 48;
const MAP_HEIGHT = 36;

function clampToArena(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clampToArena((x - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hash2d(x: number, y: number, seed: number): number {
  const value = Math.sin((x * 127.1 + y * 311.7 + seed * 74.7) * 0.0174533) * 43758.5453;
  return value - Math.floor(value);
}

function valueNoise2d(x: number, y: number, scale: number, seed: number): number {
  const nx = x / scale;
  const ny = y / scale;
  const x0 = Math.floor(nx);
  const y0 = Math.floor(ny);
  const tx = nx - x0;
  const ty = ny - y0;

  const n00 = hash2d(x0, y0, seed);
  const n10 = hash2d(x0 + 1, y0, seed);
  const n01 = hash2d(x0, y0 + 1, seed);
  const n11 = hash2d(x0 + 1, y0 + 1, seed);

  const sx = smoothstep(0, 1, tx);
  const sy = smoothstep(0, 1, ty);
  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sy);
}

function layeredNoise2d(x: number, y: number, seed: number): number {
  const coarse = valueNoise2d(x, y, 7.5, seed);
  const medium = valueNoise2d(x + 19.3, y + 7.1, 3.75, seed + 17);
  const fine = valueNoise2d(x - 11.4, y + 13.9, 1.9, seed + 31);
  return coarse * 0.58 + medium * 0.29 + fine * 0.13;
}

export function createGeneratedTilemap(): GeneratedTilemapData {
  const tiles: RitualTileId[] = new Array(MAP_WIDTH * MAP_HEIGHT);
  const props: GeneratedPropPlacement[] = [];
  const occupied = new Set<string>();
  const cx = Math.floor(MAP_WIDTH / 2);
  const cy = Math.floor(MAP_HEIGHT / 2);

  const pickStoneVariant = (detailNoise: number, distress: number): RitualTileId => {
    const adjusted = detailNoise + distress * 0.08;
    if (adjusted < 0.86) return "base_floor";
    if (adjusted < 0.94) return "cracked_floor";
    if (adjusted < 0.985) return "broken_tile";
    return "gravel_tile";
  };

  const pickOrganicFloor = (x: number, y: number, dx: number, dy: number): RitualTileId => {
    const ring = Math.max(Math.abs(dx), Math.abs(dy));
    const radial = Math.hypot(dx, dy);
    const moisture = layeredNoise2d(x + 3.7, y - 8.1, 11);
    const roughness = layeredNoise2d(x - 9.2, y + 4.4, 29);
    const growth = layeredNoise2d(x + 14.6, y + 15.2, 53);
    const detail = layeredNoise2d(x - 21.1, y - 5.9, 71);
    const distress = smoothstep(7, 18, radial);

    if (ring <= 4) {
      return pickStoneVariant(detail, 0.12);
    }

    if (ring <= 8) {
      if (growth > 0.76 && moisture > 0.58) {
        return "moss_floor";
      }
      if (detail > 0.965 && roughness > 0.62) {
        return "blood_stain";
      }
      return pickStoneVariant(detail, distress * 0.4);
    }

    if (moisture > 0.68 && growth > 0.66) {
      return growth > 0.8 ? "grass_tile" : "moss_floor";
    }

    if (roughness > 0.74 && moisture < 0.52) {
      return roughness > 0.84 ? "mud_floor" : "gravel_tile";
    }

    if (detail > 0.91 && distress > 0.45) {
      return pickStoneVariant(detail, distress);
    }

    return pickStoneVariant(detail, distress * 0.7);
  };

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const manhattan = Math.abs(dx) + Math.abs(dy);
      let tile: RitualTileId = pickOrganicFloor(x, y, dx, dy);
      const moisture = layeredNoise2d(x + 3.7, y - 8.1, 11);
      const growth = layeredNoise2d(x + 14.6, y + 15.2, 53);
      const detail = layeredNoise2d(x - 21.1, y - 5.9, 71);

      if (x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1) {
        tile = "void_tile";
      } else if (y === 1) {
        tile = "north_border";
      } else if (y === MAP_HEIGHT - 2) {
        tile = "south_border";
      } else if (x === 1) {
        tile = "west_border";
      } else if (x === MAP_WIDTH - 2) {
        tile = "east_border";
      } else if (Math.abs(dx) <= 1 || Math.abs(dy) <= 1) {
        tile = "path_tile";
      } else if (Math.abs(dx) === 2 || Math.abs(dy) === 2) {
        tile = "rune_floor";
      } else if (manhattan === 6 || manhattan === 7) {
        tile = "sigil_tile";
      } else if (Math.max(Math.abs(dx), Math.abs(dy)) > 11) {
        if (growth > 0.82 && moisture > 0.65) {
          tile = "grass_tile";
        } else if (detail > 0.96 && moisture < 0.44) {
          tile = "mud_floor";
        }
      }

      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        tile = "altar_tile";
      } else if ((Math.abs(dx) === 3 && Math.abs(dy) <= 1) || (Math.abs(dy) === 3 && Math.abs(dx) <= 1)) {
        tile = "sigil_tile";
      }

      tiles[y * MAP_WIDTH + x] = tile;
    }
  }

  const placeProp = (id: RitualPropId, col: number, row: number): void => {
    const snappedCol = clampToArena(Math.round(col), 2, MAP_WIDTH - 3);
    const snappedRow = clampToArena(Math.round(row), 2, MAP_HEIGHT - 3);
    const key = `${snappedCol}:${snappedRow}`;
    if (occupied.has(key)) {
      return;
    }
    occupied.add(key);
    props.push({ id, col: snappedCol, row: snappedRow });
  };

  // Core ritual court blockers are arranged around the center to preserve a clean
  // cross-lane while still shaping movement around the altar.
  placeProp("pillar", cx - 6, cy - 4);
  placeProp("pillar", cx + 6, cy - 4);
  placeProp("pillar", cx - 6, cy + 4);
  placeProp("pillar", cx + 6, cy + 4);

  // Torches frame the top of the court but stay clear of the vertical lane.
  placeProp("torch_candle", cx - 2, cy - 7);
  placeProp("torch_candle", cx + 2, cy - 7);

  // Shrine anchors sit off-axis so they create flanking pressure instead of dead ends.
  placeProp("statue", cx - 10, cy - 1);
  placeProp("broken_monument", cx + 10, cy + 1);
  placeProp("reliquary_decor", cx, cy - 10);

  // Peripheral dressing stays near the outer court edges.
  placeProp("bone_pile", cx - 12, cy + 9);
  placeProp("skull_pile", cx + 12, cy - 9);
  placeProp("crate_barrel", cx - 14, cy - 11);
  placeProp("crate_barrel", cx + 14, cy + 11);

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tileSize: TILESET_SIZE,
    originX: -Math.floor(MAP_WIDTH / 2) * TILESET_SIZE,
    originY: -Math.floor(MAP_HEIGHT / 2) * TILESET_SIZE,
    tiles,
    props,
  };
}

export function getGeneratedTile(
  map: GeneratedTilemapData,
  col: number,
  row: number,
): RitualTileId | null {
  if (col < 0 || row < 0 || col >= map.width || row >= map.height) {
    return null;
  }
  return map.tiles[row * map.width + col] ?? null;
}

export function isBlockingTileId(tileId: RitualTileId | null): boolean {
  if (tileId === null) {
    return false;
  }

  return tileId === "void_tile"
    || tileId === "north_border"
    || tileId === "south_border"
    || tileId === "west_border"
    || tileId === "east_border";
}

export function getBlockingTileRects(map: GeneratedTilemapData): WorldRect[] {
  const rects: WorldRect[] = [];
  for (let row = 0; row < map.height; row += 1) {
    for (let col = 0; col < map.width; col += 1) {
      const tileId = getGeneratedTile(map, col, row);
      if (!isBlockingTileId(tileId)) {
        continue;
      }
      const minX = map.originX + col * map.tileSize;
      const minY = map.originY + row * map.tileSize;
      rects.push({
        minX,
        minY,
        maxX: minX + map.tileSize,
        maxY: minY + map.tileSize,
      });
    }
  }
  return rects;
}

export function getPlayableWorldBounds(map: GeneratedTilemapData): WorldRect {
  const tileSize = map.tileSize;
  return {
    minX: map.originX + tileSize * 2,
    minY: map.originY + tileSize * 2,
    maxX: map.originX + (map.width - 2) * tileSize,
    maxY: map.originY + (map.height - 2) * tileSize,
  };
}

export function getPropObstacleRects(map: GeneratedTilemapData): WorldRect[] {
  return map.props.map((prop) => {
    const minX = map.originX + prop.col * map.tileSize;
    const minY = map.originY + prop.row * map.tileSize;
    return {
      minX,
      minY,
      maxX: minX + map.tileSize,
      maxY: minY + map.tileSize,
    };
  });
}

export function getPerimeterSpawnLanes(map: GeneratedTilemapData): WorldRect[] {
  const tileSize = map.tileSize;
  const inset = tileSize * 2;
  const laneThickness = tileSize * 3;
  const playable = getPlayableWorldBounds(map);

  return [
    {
      minX: playable.minX,
      maxX: playable.maxX,
      minY: playable.minY,
      maxY: Math.min(playable.maxY, playable.minY + laneThickness),
    },
    {
      minX: playable.minX,
      maxX: playable.maxX,
      minY: Math.max(playable.minY, playable.maxY - laneThickness),
      maxY: playable.maxY,
    },
    {
      minX: playable.minX,
      maxX: Math.min(playable.maxX, playable.minX + laneThickness),
      minY: playable.minY + inset,
      maxY: playable.maxY - inset,
    },
    {
      minX: Math.max(playable.minX, playable.maxX - laneThickness),
      maxX: playable.maxX,
      minY: playable.minY + inset,
      maxY: playable.maxY - inset,
    },
  ];
}
