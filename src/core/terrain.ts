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
  /** 整数格点取值 0..1（用置换表做确定性随机） */
  private grid(ix: number, iy: number): number {
    return this.perm[(this.perm[ix & 255] + (iy & 255)) & 511] / 511;
  }
  /** 平滑值噪声 0..1 —— 相邻格点之间线性插值，保证地形/矿层成片而非逐格跳变 */
  noise2D(x: number, y: number): number {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = this.fade(x - xi), v = this.fade(y - yi);
    const a = this.lerp(this.grid(xi, yi), this.grid(xi + 1, yi), u);
    const b = this.lerp(this.grid(xi, yi + 1), this.grid(xi + 1, yi + 1), u);
    return this.lerp(a, b, v);
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

export interface RegionStructure {
  kind: 'hut' | 'camp' | 'crystal_altar' | 'rock_altar' | 'dungeon' | 'skeleton_altar';
  x: number; y: number; // 结构左上角 tile 坐标
  width: number; height: number;
  region: RegionId;
}

export interface TerrainData {
  width: number;
  height: number;
  tiles: Uint8Array;
  regionMap: Uint8Array;
  heightMap: Uint8Array;
  structures: RegionStructure[];
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
      // M1: 平缓丘陵 — 低频大起伏 + 少量细节，去掉二元跳变（原来会产生锯齿坑洼）
      v = Math.floor((n1.fbm(x * 0.018, 0, 2) - 0.5) * 16 + (n2.noise2D(x * 0.045, 0) - 0.5) * 5);
    } else if (r.id === 'crack_waste') {
      v = Math.floor((n1.noise2D(x * 0.03, 0) - 0.5) * 14);
    } else if (r.id === 'gobi_mine') {
      base = 52;
      v = Math.floor((n1.fbm(x * 0.02, 0, 2) - 0.5) * 22);
    } else if (r.id === 'silent_sea') {
      base = 75;
      v = Math.floor((n1.noise2D(x * 0.04, 0) - 0.5) * 4);
    } else if (r.id === 'beast_hive') {
      v = Math.floor((n1.fbm(x * 0.03, 0, 2) - 0.5) * 14);
    } else if (r.id === 'underground_valley') {
      v = Math.floor((n1.noise2D(x * 0.03, 0) - 0.5) * 8);
    }

    heightMap[x] = Math.max(45, Math.min(95, base + v));
  }

  // M1: 低频山脊层 — 尖峰型噪声制造小山丘（周期约 90 格）
  for (let x = 0; x < width; x++) {
    const r = REGIONS[regionIdxAt(x)];
    const nv = n3.noise2D(x * 0.011, 13);
    const ridge = 1 - Math.abs(nv * 2 - 1);   // 0..1，尖锐山脊
    let add = Math.floor(ridge * ridge * 12);
    // 平原与谷地削弱山脊
    if (r.id === 'silent_sea') add = Math.floor(add * 0.25);
    else if (r.id === 'underground_valley') add = Math.floor(add * 0.4);
    heightMap[x] = Math.max(45, Math.min(95, heightMap[x] + add));
  }

  // 出生点平台 — 前 16 列压平，随后 12 列过渡回自然地形
  const SPAWN_H = 62;
  for (let x = 0; x < 16; x++) heightMap[x] = SPAWN_H;
  for (let x = 16; x < 30; x++) {
    const t = (x - 16) / 14;
    heightMap[x] = Math.max(45, Math.min(95, Math.round(heightMap[x] * t + SPAWN_H * (1 - t))));
  }

  // 相邻列高差限幅 2 格 + 均值平滑 —— 地表连续可走，同时保留丘陵起伏
  for (let pass = 0; pass < 3; pass++) {
    for (let x = 1; x < width; x++) {
      const d = heightMap[x] - heightMap[x - 1];
      if (d > 2) heightMap[x] = heightMap[x - 1] + 2;
      else if (d < -2) heightMap[x] = heightMap[x - 1] - 2;
    }
    for (let x = width - 2; x >= 0; x--) {
      const d = heightMap[x] - heightMap[x + 1];
      if (d > 2) heightMap[x] = heightMap[x + 1] + 2;
      else if (d < -2) heightMap[x] = heightMap[x + 1] - 2;
    }
    for (let x = 1; x < width - 1; x++) {
      heightMap[x] = Math.round((heightMap[x - 1] + heightMap[x] * 2 + heightMap[x + 1]) / 4);
    }
  }

  // 缓坡台地 — 用连续斜坡代替断崖，形成可攀爬的地貌层次
  const cliffRng = mulberry32(seed + 777);
  for (let x = 60; x < width - 40; ) {
    const total = 4 + Math.floor(cliffRng() * 4);       // 总高差 4~7 格
    const dir = cliffRng() > 0.5 ? 1 : -1;              // 抬升 / 下降
    const w = 8 + Math.floor(cliffRng() * 6);           // 斜坡宽度 8~13 格（每格 ≤1 格）
    for (let i = 0; i < w; i++) {
      const xx = x + i;
      if (xx >= width) break;
      const k = i / w;
      heightMap[xx] = Math.max(45, Math.min(95, heightMap[xx] + Math.round(dir * total * k)));
    }
    x += 70 + Math.floor(cliffRng() * 60);
  }

  // 最终再限幅一次，确保任何位置落差都不超过 2 格（可跳过）
  for (let pass = 0; pass < 2; pass++) {
    for (let x = 1; x < width; x++) {
      const d = heightMap[x] - heightMap[x - 1];
      if (d > 2) heightMap[x] = heightMap[x - 1] + 2;
      else if (d < -2) heightMap[x] = heightMap[x - 1] - 2;
    }
    for (let x = width - 2; x >= 0; x--) {
      const d = heightMap[x] - heightMap[x + 1];
      if (d > 2) heightMap[x] = heightMap[x + 1] + 2;
      else if (d < -2) heightMap[x] = heightMap[x + 1] - 2;
    }
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
  const structures = buildStructures(tiles, heightMap, rng);

  return { width, height, tiles, regionMap, heightMap, structures };
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

function shallowBlock(r: RegionId, x: number, y: number, n1: ValueNoise, n2: ValueNoise, n3: ValueNoise, _rng: () => number): number {
  const noise = n1.noise2D(x * 0.08, y * 0.08);
  switch (r) {
    case 'wreck_zone':
      // 低频噪声 → 金属残片成片分布，避免逐格跳色造成"马赛克"观感
      if (noise > 0.80) return bi('wreck_scrap');
      if (n3.noise2D(x * 0.05, y * 0.05) > 0.62) return bi('wreck_hull');
      return bi('cracked_ground');
    case 'crack_waste':
      if (noise > 0.66) return bi('cracked_ground');
      if (noise < 0.22) return bi('surface_dust');
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

    // 大框架: 洞穴底部埋 1~2 簇晶簇 —— 浅层生命晶簇、深层魔力晶簇
    // 开采后掉落对应水晶，配合 U 键永久提升上限，形成「探索 → 成长」闭环
    const nodeId = ry < 108 ? 'life_crystal_node' : 'mana_crystal_node';
    const clusters = 1 + Math.floor(rng() * 2);
    for (let c = 0; c < clusters; c++) {
      const ang = Math.PI * (0.2 + rng() * 0.6); // 偏下半圈，贴近洞底
      const dist = rad * (0.45 + rng() * 0.35);
      const nx = Math.round(rx + Math.cos(ang) * dist);
      const ny = Math.round(ry + Math.sin(ang) * dist);
      if (nx < 1 || nx >= MAP_WIDTH - 1 || ny < 1 || ny >= MAP_HEIGHT - 1) continue;
      if (tiles[ny * MAP_WIDTH + nx] !== bi('empty')) continue;
      tiles[ny * MAP_WIDTH + nx] = bi(nodeId);
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

export function regionIdAt(col: number): RegionId {
  return REGIONS[regionIdxAt(col)].id;
}

/**
 * 区块内结构生成：每个区块 1 个 NPC 小屋 / 据点
 * 小屋 = 4×3 内部空间 + rebel_brick 墙
 */
function buildStructures(tiles: Uint8Array, heightMap: Uint8Array, rng: () => number): RegionStructure[] {
  const structures: RegionStructure[] = [];
  const wallId = bi('rebel_brick');

  // 在 6 个区块各放一个结构（避开 underground_valley 的暗能量紫柱区）
  const hutPositions: { regionCol: [number, number]; kind: RegionStructure['kind']; name: RegionId }[] = [
    { regionCol: [30, 50],  kind: 'hut', name: 'wreck_zone' },
    { regionCol: [80, 100], kind: 'hut', name: 'crack_waste' },
    { regionCol: [140, 160], kind: 'hut', name: 'gobi_mine' },
    { regionCol: [200, 220], kind: 'camp', name: 'silent_sea' },
    { regionCol: [260, 280], kind: 'hut', name: 'beast_hive' },
    { regionCol: [305, 320], kind: 'camp', name: 'underground_valley' },
  ];

  for (const hp of hutPositions) {
    // 选一个区块内的 col
    const col = hp.regionCol[0] + Math.floor(rng() * (hp.regionCol[1] - hp.regionCol[0]));
    const groundY = heightMap[col];
    const hutW = hp.kind === 'camp' ? 7 : 5;
    const hutH = hp.kind === 'camp' ? 4 : 3;
    const hutX = col - Math.floor(hutW / 2);
    const hutY = groundY - hutH;

    // 确保 hutX 范围合法
    if (hutX < 2 || hutX + hutW >= MAP_WIDTH - 2) continue;

    // 清出内部空间
    for (let dx = 0; dx < hutW; dx++) {
      for (let dy = 0; dy < hutH; dy++) {
        const tx = hutX + dx, ty = hutY + dy;
        if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
        tiles[ty * MAP_WIDTH + tx] = bi('empty');
      }
    }
    // 墙（四周）
    for (let dx = 0; dx < hutW; dx++) {
      // 顶
      if (hutY - 1 >= 0) tiles[(hutY - 1) * MAP_WIDTH + (hutX + dx)] = wallId;
      // 两侧墙
      for (let dy = 0; dy < hutH; dy++) {
        if (hutX - 1 >= 0) tiles[(hutY + dy) * MAP_WIDTH + (hutX - 1)] = wallId;
        if (hutX + hutW < MAP_WIDTH) tiles[(hutY + dy) * MAP_WIDTH + (hutX + hutW)] = wallId;
      }
    }
    // 门：在左墙开出通道（玩家 2.6 格高、1.25 格宽，2 格高/1 格宽的旧门会卡住身体）
    // 顶部向下覆盖内外地面高差，保证任何地形都能走进小屋
    const doorCol = hutX - 1;
    if (doorCol >= 0) {
      const outerY = heightMap[Math.max(0, hutX - 2)];
      const top = Math.min(groundY, outerY) - 3;
      const bottom = Math.max(groundY, outerY) - 1;
      for (let ty = Math.max(0, top); ty <= Math.min(MAP_HEIGHT - 1, bottom); ty++) {
        tiles[ty * MAP_WIDTH + doorCol] = bi('empty');
      }
    }
    // 地板（确保是 rebel_brick）
    for (let dx = 0; dx < hutW; dx++) {
      const tx = hutX + dx;
      const ty = groundY;
      if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
        if (tiles[ty * MAP_WIDTH + tx] !== bi('void_barrier')) {
          tiles[ty * MAP_WIDTH + tx] = wallId;
        }
      }
    }

    structures.push({
      kind: hp.kind,
      x: hutX, y: hutY,
      width: hutW, height: hutH,
      region: hp.name,
    });

    // M20: wreck_zone 小屋内放流浪商人 NPC
    if (hp.name === 'wreck_zone') {
      const npcX = hutX + 1;
      const npcY = groundY - 1;
      if (npcX >= 0 && npcX < MAP_WIDTH && npcY >= 0 && npcY < MAP_HEIGHT) {
        tiles[npcY * MAP_WIDTH + npcX] = bi('merchant_npc');
      }
      // M21: 残骸试炼坛（小屋右侧）
      const wx = hutX + hutW + 3;
      if (wx >= 0 && wx < MAP_WIDTH) tiles[groundY * MAP_WIDTH + wx] = bi('wreck_trial_altar');
    }
    // M21: 野兽试炼坛
    if (hp.name === 'beast_hive') {
      const bx = hutX + hutW + 3;
      if (bx >= 0 && bx < MAP_WIDTH) tiles[groundY * MAP_WIDTH + bx] = bi('beast_trial_altar');
    }
    // M21: 虚空试炼坛（地底幽谷深层）
    if (hp.name === 'underground_valley') {
      const vx = hutX + 2;
      const vy = Math.min(MAP_HEIGHT - 10, groundY + 15);
      if (vx >= 0 && vx < MAP_WIDTH && vy >= 0 && vy < MAP_HEIGHT) {
        tiles[vy * MAP_WIDTH + vx] = bi('void_trial_altar');
      }
    }
  }

  // deep crystal altar（第二个 Boss 位置）
  for (let attempt = 0; attempt < 20; attempt++) {
    const cx = 310 + Math.floor(rng() * 40);
    const cy = 130 + Math.floor(rng() * 30);
    if (cx < 0 || cx >= MAP_WIDTH || cy < 0 || cy >= MAP_HEIGHT) continue;
    // 清出空间
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        if (dx * dx + dy * dy > 9) continue;
        const tx = cx + dx, ty = cy + dy;
        if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
        if (tiles[ty * MAP_WIDTH + tx] !== bi('void_barrier')) {
          tiles[ty * MAP_WIDTH + tx] = bi('empty');
        }
      }
    }
    // 周围放 8 个 void_crystal 作为祭坛装饰
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const tx = cx + Math.round(Math.cos(angle) * 4);
      const ty = cy + Math.round(Math.sin(angle) * 4);
      if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
      tiles[ty * MAP_WIDTH + tx] = bi('void_crystal');
    }
    structures.push({
      kind: 'crystal_altar',
      x: cx - 3, y: cy - 3,
      width: 7, height: 7,
      region: 'underground_valley',
    });
    break;
  }

  // rock_altar（rock_titan 位置）— gobi_mine 深层
  for (let attempt = 0; attempt < 30; attempt++) {
    const cx = 135 + Math.floor(rng() * 30); // 135-165 col（gobi_mine 中央）
    const cy = 120 + Math.floor(rng() * 40); // 120-160 deep
    if (cx < 0 || cx >= MAP_WIDTH || cy < 0 || cy >= MAP_HEIGHT) continue;
    // 清出较大空间（比 crystal_altar 大一倍，泰坦需要更多场地）
    for (let dx = -5; dx <= 5; dx++) {
      for (let dy = -5; dy <= 5; dy++) {
        if (dx * dx + dy * dy > 25) continue;
        const tx = cx + dx, ty = cy + dy;
        if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
        tiles[ty * MAP_WIDTH + tx] = bi('empty');
      }
    }
    // 周围放 ore_rock 围圈 + 顶部 ore_gold 发光点
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const rad = 6;
      const tx = cx + Math.round(Math.cos(angle) * rad);
      const ty = cy + Math.round(Math.sin(angle) * rad);
      if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;
      tiles[ty * MAP_WIDTH + tx] = bi('ore_rock');
    }
    // 顶部 4 个发光金矿
    tiles[(cy - 6) * MAP_WIDTH + cx] = bi('ore_gold');
    tiles[(cy - 5) * MAP_WIDTH + (cx - 2)] = bi('ore_gold');
    tiles[(cy - 5) * MAP_WIDTH + (cx + 2)] = bi('ore_gold');
    tiles[(cy - 4) * MAP_WIDTH + cx] = bi('ore_gold');
    structures.push({
      kind: 'rock_altar',
      x: cx - 6, y: cy - 6,
      width: 13, height: 13,
      region: 'gobi_mine',
    });
    break;
  }

  // 大框架: 地牢 — 地底幽谷深处的地下建筑（骷髅王门锁 + 守卫）
  {
    const DX = 316, DY = 108, DW = 34, DH = 16;
    const brick = bi('dungeon_brick');
    const door = bi('dungeon_door');
    // 2 格厚外壳，内部掏空
    for (let dy = 0; dy < DH; dy++) {
      for (let dx = 0; dx < DW; dx++) {
        const x = DX + dx, y = DY + dy;
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) continue;
        const edge = dx < 2 || dx >= DW - 2 || dy < 2 || dy >= DH - 2;
        tiles[y * MAP_WIDTH + x] = edge ? brick : bi('empty');
      }
    }
    // 内部陈设：宝箱（战利品由 main 初始化）+ 金矿点缀
    const chestSpots: [number, number][] = [
      [DX + 6, DY + DH - 3],
      [DX + DW - 8, DY + DH - 3],
    ];
    for (const [cx, cy] of chestSpots) {
      tiles[cy * MAP_WIDTH + cx] = bi('chest');
    }
    for (let i = 0; i < 6; i++) {
      const gx = DX + 4 + Math.floor(rng() * (DW - 8));
      const gy = DY + 2 + Math.floor(rng() * 3);
      tiles[gy * MAP_WIDTH + gx] = bi('ore_gold');
    }
    // 大框架: 地牢深处固定 2 簇水晶，作为深入探索的保底成长奖励
    tiles[(DY + 3) * MAP_WIDTH + (DX + 3)] = bi('life_crystal_node');
    tiles[(DY + DH - 4) * MAP_WIDTH + (DX + DW - 4)] = bi('mana_crystal_node');
    // 竖井：地表 → 地牢顶部，2 格宽，两侧砖壁
    const s0 = DX + Math.floor(DW / 2) - 1;
    const s1 = s0 + 1;
    const surfY = heightMap[s0];
    for (let y = Math.max(0, surfY); y <= DY + 1; y++) {
      tiles[y * MAP_WIDTH + (s0 - 1)] = brick;
      tiles[y * MAP_WIDTH + (s1 + 1)] = brick;
      tiles[y * MAP_WIDTH + s0] = bi('empty');
      tiles[y * MAP_WIDTH + s1] = bi('empty');
    }
    // 井口立柱（地表上方标记入口）
    for (let y = Math.max(0, surfY - 3); y < surfY; y++) {
      tiles[y * MAP_WIDTH + (s0 - 1)] = brick;
      tiles[y * MAP_WIDTH + (s1 + 1)] = brick;
    }
    // 井底锁门：未击败骷髅王时不可破坏
    for (const x of [s0, s1]) {
      for (let y = DY; y <= DY + 1; y++) {
        tiles[y * MAP_WIDTH + x] = door;
      }
    }
    structures.push({
      kind: 'dungeon',
      x: DX, y: DY, width: DW, height: DH,
      region: 'underground_valley',
    });
    // 骷髅祭坛：井口右侧地表
    const altarX = s1 + 3;
    if (altarX < MAP_WIDTH && surfY - 1 >= 0) {
      tiles[(surfY - 1) * MAP_WIDTH + altarX] = bi('dungeon_altar');
      structures.push({
        kind: 'skeleton_altar',
        x: altarX, y: surfY - 1, width: 1, height: 1,
        region: 'underground_valley',
      });
    }
  }

  return structures;
}
