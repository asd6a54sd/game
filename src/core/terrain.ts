/**
 * 烬海纪元 · 地形生成器
 * 第一幕《特恩无人区》横向剖面 — 6 区块 × 3 地层
 */
import { BLOCKS } from './blocks.js';

export type RegionId =
  | 'wreck_zone'
  | 'crack_waste'
  | 'gobi_mine'
  | 'silent_sea'
  | 'beast_hive'
  | 'underground_valley';

export interface Region {
  id: RegionId;
  name: string;
  startCol: number;
  endCol: number;
  palette: string[];
  description: string;
}

export const MAP_WIDTH = 360;
export const MAP_HEIGHT = 180;
export const TILE_SIZE = 16;

export const REGIONS: Region[] = [
  { id: 'wreck_zone', name: '烬落残骸带', startCol: 0,   endCol: 60,  palette: ['rust', 'iron', 'ember'], description: '坠舰残骸与断口火焰' },
  { id: 'crack_waste', name: '龟裂荒原',   startCol: 60,  endCol: 120, palette: ['rust', 'bone'],          description: '风蚀岩柱、网状地裂' },
  { id: 'gobi_mine',   name: '戈壁矿脉',   startCol: 120, endCol: 180, palette: ['bone', 'iron', 'ember'], description: '高地 + 三层地下矿带剖面' },
  { id: 'silent_sea',  name: '无声海',     startCol: 180, endCol: 240, palette: ['cold', 'iron'],          description: '液态金属湖与浮游金属体' },
  { id: 'beast_hive',  name: '异兽巢穴',   startCol: 240, endCol: 300, palette: ['bone', 'void'],          description: '甲壳蜂巢与幽蓝荧光' },
  { id: 'underground_valley', name: '地底幽谷', startCol: 300, endCol: 360, palette: ['void', 'iron'], description: '叛军据点与暗能量结界' },
];

// ========== 噪声 ==========
class ValueNoise {
  private perm: number[];
  constructor(seed: number) {
    const rng = mulberry32(seed);
    this.perm = Array.from({ length: 512 }, (_, i) => i).sort(() => rng() - 0.5);
  }
  private fade(t: number) { return t * t * (3 - 2 * t); }
  private lerp(a: number, b: number, t: number) { return a + t * (b - a); }
  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = this.fade(x), v = this.fade(y);
    const A = this.perm[X] + Y, AA = this.perm[A], AB = this.perm[A + 1];
    const B = this.perm[X + 1] + Y, BA = this.perm[B], BB = this.perm[B + 1];
    return this.lerp(
      this.lerp(hash(this.perm[AA], x, y), hash(this.perm[BA], x - 1, y), u),
      this.lerp(hash(this.perm[AB], x, y - 1), hash(this.perm[BB], x - 1, y - 1), u),
      v
    );
  }
  fbm(x: number, y: number, octaves = 4): number {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < octaves; i++) {
      v += a * this.noise2D(x * f, y * f);
      f *= 2; a *= 0.5;
    }
    return v;
  }
}
function hash(p: number, x: number, y: number) {
  const h = p * 374761393 + x * 668265263 + y * 1442695040888963407;
  const n = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
}
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ========== BlockId → 紧凑整数编码 ==========
const BLOCK_ID_LIST = Object.keys(BLOCKS);
const BLOCK_INDEX: Record<string, number> = {};
BLOCK_ID_LIST.forEach((id, i) => { BLOCK_INDEX[id] = i; });
export const BLOCK_COUNT = BLOCK_ID_LIST.length;

function bi(id: string): number {
  return BLOCK_INDEX[id] ?? 0;
}
export function biToBlock(idx: number): string {
  return BLOCK_ID_LIST[idx] ?? 'empty';
}

export interface TerrainData {
  width: number;
  height: number;
  tiles: Uint8Array;
  regionMap: Uint8Array;
  heightMap: Uint8Array;
}

export function generateTerrain(seed = 20261116): TerrainData {
  const rng = mulberry32(seed);
  const n1 = new ValueNoise(seed);
  const n2 = new ValueNoise(seed + 999);
  const n3 = new ValueNoise(seed + 4242);

  const width = MAP_WIDTH;
  const height = MAP_HEIGHT;
  const tiles = new Uint8Array(width * height);
  const regionMap = new Uint8Array(width * height);
  const heightMap = new Uint8Array(width);

  // --- 地表高度 ---
  for (let x = 0; x < width; x++) {
    const regionIdx = regionIdxAt(x);
    const r = REGIONS[regionIdx];
    let base = 60, v = 0;

    if (r.id === 'wreck_zone') {
      v = Math.floor(n1.fbm(x * 0.08, 0, 3) * 20) + (n2.noise2D(x * 0.12, 0) > 0.6 ? 8 : -4);
    } else if (r.id === 'crack_waste') {
      v = Math.floor(n1.noise2D(x * 0.04, 0) * 12);
    } else if (r.id === 'gobi_mine') {
      base = 52;
      v = Math.floor(n1.fbm(x * 0.05, 0, 3) * 25);
    } else if (r.id === 'silent_sea') {
      base = 75;
      v = Math.floor(n1.noise2D(x * 0.06, 0) * 6) - 3;
    } else if (r.id === 'beast_hive') {
      v = Math.floor(n1.fbm(x * 0.1, 0, 3) * 15);
    } else if (r.id === 'underground_valley') {
      v = Math.floor(n1.noise2D(x * 0.05, 0) * 8);
    }

    heightMap[x] = Math.max(45, Math.min(95, base + v));
  }

  // --- 填充 ---
  for (let x = 0; x < width; x++) {
    const ri = regionIdxAt(x);
    const r = REGIONS[ri];
    const sy = heightMap[x];

    for (let y = 0; y < height; y++) {
      const idx = y * width + x;
      regionMap[idx] = ri;
      tiles[idx] = bi('empty');
      if (y < sy) continue;

      if (y === sy) {
        tiles[idx] = surfaceBlock(r.id, x, y, n1, n2, rng);
      } else if (y < sy + 20) {
        tiles[idx] = shallowBlock(r.id, x, y, n1, n2, n3, rng);
      } else if (y < sy + 55) {
        tiles[idx] = midBlock(r.id, x, y, n1, n2, n3, rng);
      } else {
        tiles[idx] = deepBlock(r.id, x, y, n1, n2, n3, rng);
      }
    }
  }

  carveStructures(tiles, heightMap, rng);

  return { width, height, tiles, regionMap, heightMap };
}

function regionIdxAt(x: number): number {
  for (let i = 0; i < REGIONS.length; i++) {
    if (x >= REGIONS[i].startCol && x < REGIONS[i].endCol) return i;
  }
  return 0;
}

function surfaceBlock(r: RegionId, x: number, y: number, n1: ValueNoise, n2: ValueNoise, _rng: () => number): number {
  switch (r) {
    case 'wreck_zone':
      if (n1.noise2D(x * 0.15, y * 0.15) > 0.75) return bi('fire_crack');
      if (n2.noise2D(x * 0.1, y * 0.1) > 0.6) return bi('wreck_hull');
      return bi('wreck_scrap');
    case 'crack_waste':
      if (n1.noise2D(x * 0.2, y * 0.2) > 0.7) return bi('wind_rock');
      return bi('cracked_ground');
    case 'gobi_mine': return bi('desert_ground');
    case 'silent_sea': return bi('liquid_metal');
    case 'beast_hive':
      if (n1.noise2D(x * 0.18, y * 0.18) > 0.7) return bi('chitin_hive');
      return bi('cracked_ground');
    case 'underground_valley':
      if (y < 70) return bi('rebel_brick');
      return bi('cracked_ground');
  }
}

function shallowBlock(r: RegionId, x: number, y: number, n1: ValueNoise, n2: ValueNoise, n3: ValueNoise, rng: () => number): number {
  const noise = n1.noise2D(x * 0.08, y * 0.08);
  switch (r) {
    case 'wreck_zone':
      if (noise > 0.7) return bi('wreck_scrap');
      if (rng() > 0.92) return bi('ember_ash');
      return bi('cracked_ground');
    case 'crack_waste':
      if (noise > 0.6) return bi('cracked_ground');
      if (noise < 0.3) return bi('surface_dust');
      return bi('wind_rock');
    case 'gobi_mine': return bi('desert_ground');
    case 'silent_sea':
      if (n2.noise2D(x * 0.1, y * 0.1) > 0.78 && n3.noise2D(x * 0.15, y * 0.15) > 0.5) return bi('metal_float');
      return bi('liquid_metal');
    case 'beast_hive':
      if (noise > 0.72) return bi('chitin_hive');
      if (n2.noise2D(x * 0.15, y * 0.15) > 0.85) return bi('bio_glow');
      return bi('cracked_ground');
    case 'underground_valley': return bi('cracked_ground');
  }
}

function midBlock(r: RegionId, x: number, y: number, _n1: ValueNoise, n2: ValueNoise, n3: ValueNoise, _rng: () => number): number {
  const oreNoise = n2.noise2D(x * 0.2, y * 0.2);
  if (r === 'silent_sea') return bi('ore_rock');

  if (r === 'underground_valley') {
    if (n3.noise2D(x * 0.12, y * 0.12) > 0.45) return bi('rebel_brick');
    if (oreNoise > 0.85) return bi('void_crystal');
    return bi('ore_rock');
  }

  // 三层矿带
  if (y < 85) {
    if (oreNoise > 0.78) return bi('ore_copper');
  } else if (y < 100) {
    if (oreNoise > 0.75) return bi('ore_iron');
  } else if (y < 115) {
    if (oreNoise > 0.85) return bi('ore_gold');
  }
  return bi('ore_rock');
}

function deepBlock(r: RegionId, x: number, y: number, n1: ValueNoise, n2: ValueNoise, n3: ValueNoise, _rng: () => number): number {
  const crystalNoise = n2.noise2D(x * 0.15, y * 0.15);
  const voidNoise = n3.noise2D(x * 0.08, y * 0.08);
  const noise = n1.noise2D(x * 0.04, y * 0.04);

  if (r === 'underground_valley') {
    if (voidNoise > 0.7) return bi('void_barrier');
    if (crystalNoise > 0.8) return bi('void_crystal');
    return bi('deep_rock');
  }

  if (crystalNoise > 0.88) return bi('crystal_glow');
  if (noise < 0.25) return bi('crystal_glow');
  return bi('deep_rock');
}

function carveStructures(tiles: Uint8Array, heightMap: Uint8Array, rng: () => number) {
  // 1. 洞穴空洞
  for (let i = 0; i < 18; i++) {
    const rx = 30 + Math.floor(rng() * (MAP_WIDTH - 60));
    const ry = 85 + Math.floor(rng() * 60);
    const rad = 3 + Math.floor(rng() * 6);
    for (let dx = -rad; dx <= rad; dx++) {
      for (let dy = -rad; dy <= rad; dy++) {
        if (dx * dx + dy * dy > rad * rad) continue;
        const x = rx + dx, y = ry + dy;
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) continue;
        tiles[y * MAP_WIDTH + x] = bi('empty');
      }
    }
  }

  // 2. 地底幽谷：暗能量紫柱
  for (let x = 320; x < 355; x++) {
    const sy = heightMap[x];
    for (let y = sy + 55; y < sy + 70; y++) {
      if (y >= MAP_HEIGHT) break;
      tiles[y * MAP_WIDTH + x] = bi('void_barrier');
    }
  }

  // 3. 无声海：液态金属湖面拓宽
  for (let x = 180; x < 240; x++) {
    const sy = heightMap[x];
    for (let y = sy - 8; y < sy; y++) {
      if (y < 0) break;
      tiles[y * MAP_WIDTH + x] = bi('liquid_metal');
    }
  }

  // 4. 异兽巢穴：蜂巢柱
  for (let x = 250; x < 295; x += 3 + Math.floor(rng() * 3)) {
    const sy = heightMap[x];
    const h = 3 + Math.floor(rng() * 5);
    for (let dy = 1; dy <= h; dy++) {
      if (sy - dy < 0) break;
      tiles[(sy - dy) * MAP_WIDTH + x] = bi('chitin_hive');
    }
  }
}

export function regionNameAt(col: number): string {
  return REGIONS[regionIdxAt(col)].name;
}
